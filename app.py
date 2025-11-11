#!/usr/bin/env python3
"""
Flask backend server for the MaKo Knowledge Management System.

This server handles:
- Document upload and conversion (Confluence .doc to HTML)
- Image extraction from uploaded documents
- Navigation tree management
- File serving and API endpoints
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import re
import json
import quopri
import base64
import html
from pathlib import Path
from werkzeug.utils import secure_filename
from typing import Tuple, Dict, List, Optional

app = Flask(__name__, static_folder='.')
CORS(app)

UPLOAD_FOLDER = Path('upload')
UPLOAD_HTML_FOLDER = Path('upload-html')
METADATA_FILE = UPLOAD_HTML_FOLDER / 'metadata.json'

UPLOAD_FOLDER.mkdir(exist_ok=True)
UPLOAD_HTML_FOLDER.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {'doc'}

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed.

    Args:
        filename: Name of the file to check

    Returns:
        True if file has allowed extension, False otherwise
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def filename_to_title(filename: str) -> str:
    """Convert filename to readable title.

    Args:
        filename: The filename to convert

    Returns:
        Human-readable title string
    """
    from urllib.parse import unquote
    text = filename.replace('.doc', '').replace('+', ' ')
    text = unquote(text)
    return text


def decode_html_content(encoded_html: str, encoding_type: str) -> str:
    """Decode HTML content based on encoding type.

    Args:
        encoded_html: The encoded HTML string
        encoding_type: Either 'base64' or 'quoted-printable'

    Returns:
        Decoded HTML string
    """
    if encoding_type == 'base64':
        try:
            # Remove whitespace from base64 data
            clean_base64 = re.sub(r'\s+', '', encoded_html)
            decoded_bytes = base64.b64decode(clean_base64)

            # Try UTF-16 first (common for Word exports), then UTF-8
            try:
                return decoded_bytes.decode('utf-16', errors='ignore')
            except UnicodeDecodeError:
                return decoded_bytes.decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Base64 decode error: {e}")
            return encoded_html

    elif encoding_type == 'quoted-printable':
        try:
            encoded_bytes = encoded_html.encode('utf-8')
            decoded_bytes = quopri.decodestring(encoded_bytes)
            return decoded_bytes.decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Quoted-printable decode error: {e}")
            return encoded_html

    # No encoding or unknown encoding
    return encoded_html


def extract_image_from_part(part: str) -> Optional[Tuple[str, bytes]]:
    """Extract a single image from a MIME part.

    Args:
        part: MIME part containing potential image data

    Returns:
        Tuple of (image_key, image_data) if found, None otherwise
    """
    if 'Content-Transfer-Encoding: base64' not in part:
        return None

    # Look for image files in Content-Location
    # Pattern 1: file:///C:/HASH/path/to/image.png (new style - full path)
    location_match = re.search(
        r'Content-Location: file:///C:/[a-fA-F0-9]+/(.*?\.(?:png|jpg|jpeg|gif))',
        part,
        re.IGNORECASE
    )

    if location_match:
        # Full path found: "MyDoc003.fld/image001.png"
        image_path = location_match.group(1)
        return extract_base64_image(part, image_path)

    # Try old pattern: just the hash
    location_match = re.search(r'Content-Location: file:///C:/([a-fA-F0-9]+)$', part)
    if location_match:
        image_hash = location_match.group(1)
        return extract_base64_image(part, image_hash)

    return None


def extract_base64_image(part: str, image_key: str) -> Optional[Tuple[str, bytes]]:
    """Extract base64-encoded image data from MIME part.

    Args:
        part: MIME part containing image data
        image_key: Key identifier for the image (path or hash)

    Returns:
        Tuple of (image_key, image_data) if successful, None otherwise
    """
    content_start = part.find('\n\n')
    if content_start == -1:
        return None

    content_start += 2
    base64_data = part[content_start:].strip()
    base64_data = re.sub(r'\s+', '', base64_data)

    try:
        image_data = base64.b64decode(base64_data)
        return (image_key, image_data)
    except Exception as e:
        print(f"Warning: Failed to decode image {image_key}: {e}")
        return None


def determine_image_filename(image_key: str, image_data: bytes) -> str:
    """Determine the filename for an image based on its key and data.

    Args:
        image_key: Either a path like "MyDoc003.fld/image001.png" or a hash
        image_data: Raw image bytes

    Returns:
        Appropriate filename for the image
    """
    import os

    # Check if it's a path with filename
    if '/' in image_key or '\\' in image_key:
        return os.path.basename(image_key)

    # It's a hash - determine extension from image data
    if image_data.startswith(b'\x89PNG'):
        ext = 'png'
    elif image_data.startswith(b'\xff\xd8\xff'):
        ext = 'jpg'
    elif image_data.startswith(b'GIF'):
        ext = 'gif'
    else:
        ext = 'png'

    return f"{image_key}.{ext}"


def save_images_and_update_html(
    html_content: str,
    images: Dict[str, bytes],
    output_dir: Path
) -> Tuple[str, int]:
    """Save extracted images to disk and update HTML references.

    Args:
        html_content: HTML content with image references
        images: Dictionary mapping image keys to image data
        output_dir: Directory to save images

    Returns:
        Tuple of (updated_html_content, number_of_images_saved)
    """
    images_dir = output_dir / 'images'
    images_dir.mkdir(exist_ok=True)

    saved_count = 0

    for image_key, image_data in images.items():
        filename = determine_image_filename(image_key, image_data)

        # Save image
        image_path = images_dir / filename
        with open(image_path, 'wb') as f:
            f.write(image_data)

        saved_count += 1

        # Replace in HTML - handle both full path and just filename
        html_content = html_content.replace(
            f'src="{image_key}"',
            f'src="images/{filename}"'
        )

        if '/' in image_key:
            # Also try just the filename
            html_content = html_content.replace(
                f'src="{filename}"',
                f'src="images/{filename}"'
            )

    return html_content, saved_count


def remove_confluence_metadata(html_content: str) -> str:
    """Remove Confluence-specific metadata from HTML.

    Args:
        html_content: HTML content with Confluence metadata

    Returns:
        Cleaned HTML content
    """
    # Remove "Page Owner" and "Page contact" lines
    html_content = re.sub(
        r'<p>.*?[Pp]age [Oo](wner|ner).*?</p>',
        '',
        html_content,
        flags=re.DOTALL
    )
    html_content = re.sub(
        r'<p>.*?[Pp]age [Cc]ontact.*?</p>',
        '',
        html_content,
        flags=re.DOTALL
    )

    return html_content

def extract_html_and_images(
    doc_path: Path,
    output_dir: Path
) -> Tuple[bool, str, int]:
    """Extract HTML content and images from a Confluence-exported Word file.

    This function parses Confluence .doc exports which are MIME multipart documents
    containing base64 or quoted-printable encoded HTML and images.

    Args:
        doc_path: Path to the .doc file
        output_dir: Directory to save extracted images

    Returns:
        Tuple of (success, result_or_error_message, number_of_images)
    """
    try:
        with open(doc_path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()

        # Parse MIME parts
        parts = _split_mime_parts(text)

        # Extract HTML and images from parts
        html_content = None
        images = {}

        for part in parts:
            # Extract HTML content (only first occurrence)
            if 'Content-Type: text/html' in part and html_content is None:
                html_content = _extract_html_from_part(part)

            # Extract images
            else:
                image_result = extract_image_from_part(part)
                if image_result:
                    image_key, image_data = image_result
                    images[image_key] = image_data

        # Validate and process HTML
        if not html_content or '<html' not in html_content.lower():
            return False, "Could not extract valid HTML content", 0

        # Save images and update HTML references
        html_content, num_images = save_images_and_update_html(
            html_content, images, output_dir
        )

        # Clean up Confluence metadata
        html_content = remove_confluence_metadata(html_content)

        return True, html_content, num_images

    except Exception as e:
        return False, f"Error processing document: {str(e)}", 0


def _split_mime_parts(text: str) -> List[str]:
    """Split MIME multipart text into individual parts.

    Args:
        text: Full MIME multipart document text

    Returns:
        List of MIME parts
    """
    # Try to find the actual boundary from the Content-Type header
    boundary_match = re.search(r'boundary="(.*?)"', text)
    if boundary_match:
        boundary = boundary_match.group(1)
        return text.split('--' + boundary)

    # Fallback: try common boundary patterns
    boundary_pattern = r'------=_(Part|NextPart)_[A-F0-9._]+'
    return re.split(boundary_pattern, text)


def _extract_html_from_part(part: str) -> Optional[str]:
    """Extract HTML content from a MIME part.

    Args:
        part: MIME part potentially containing HTML

    Returns:
        Decoded HTML string or None if extraction fails
    """
    content_start = part.find('\n\n')
    if content_start == -1:
        return None

    content_start += 2
    encoded_html = part[content_start:].strip()

    # Determine encoding type and decode
    if 'Content-Transfer-Encoding: base64' in part:
        return decode_html_content(encoded_html, 'base64')
    elif 'Content-Transfer-Encoding: quoted-printable' in part:
        return decode_html_content(encoded_html, 'quoted-printable')
    else:
        # No encoding or unknown encoding - use as is
        return encoded_html

def extract_navigation_from_html(html_content: str) -> Optional[str]:
    """Extract navigation breadcrumb from HTML content.

    Looks for patterns like "Navigation: APE > Category > Document Title"
    in the HTML content.

    Args:
        html_content: HTML document content

    Returns:
        Navigation path string or None if not found
    """
    # Strip all HTML tags first to get plain text
    plain_text = re.sub(r'<[^>]+>', '', html_content)

    # Look for "Navigation: " followed by the path
    # Use multiline pattern to handle line breaks in the navigation text
    match = re.search(
        r'Navigation:\s*(.+?)(?:\n\n|\r\n\r\n|$)',
        plain_text,
        re.IGNORECASE | re.DOTALL
    )

    if match:
        # Decode HTML entities (e.g., &gt; -> >)
        nav_text = html.unescape(match.group(1).strip())
        # Remove internal line breaks and extra whitespace
        nav_text = re.sub(r'\s+', ' ', nav_text)
        return nav_text

    return None


def remove_navigation_from_html(html_content: str) -> str:
    """Remove the navigation line from HTML content.

    The navigation line is used for tree building but shouldn't be
    displayed in the final document.

    Args:
        html_content: HTML content with navigation line

    Returns:
        HTML content without navigation line
    """
    # Remove lines containing "Navigation:" (case-insensitive)
    # This includes the whole paragraph or div containing it
    html_content = re.sub(
        r'<p[^>]*>.*?Navigation:.*?</p>',
        '',
        html_content,
        flags=re.IGNORECASE | re.DOTALL
    )
    html_content = re.sub(
        r'<div[^>]*>.*?Navigation:.*?</div>',
        '',
        html_content,
        flags=re.IGNORECASE | re.DOTALL
    )
    return html_content


def parse_navigation_path(nav_path: str) -> List[str]:
    """Parse navigation path into hierarchy.

    Args:
        nav_path: Navigation string like "APE > Category > Document"

    Returns:
        List of path components: ["APE", "Category", "Document"]
    """
    # Split by > and clean up whitespace
    parts = [part.strip() for part in nav_path.split('>')]
    return parts


def generate_html_filename(navigation_parts: List[str]) -> str:
    """Generate HTML filename from navigation path.

    Concatenates all navigation parts with underscores, removes spaces.

    Args:
        navigation_parts: List of navigation components ["APE", "Category", "Document"]

    Returns:
        Filename like "APE_Category_Document.html"
    """
    # Remove spaces from each part and join with underscores
    clean_parts = [part.replace(' ', '') for part in navigation_parts]
    filename = '_'.join(clean_parts) + '.html'
    return filename


def load_metadata() -> Dict[str, dict]:
    """Load consolidated metadata from metadata.json.

    Returns:
        Dictionary mapping filenames to their metadata
    """
    if not METADATA_FILE.exists():
        return {}

    try:
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return {}


def save_metadata(metadata: Dict[str, dict]) -> bool:
    """Save consolidated metadata to metadata.json.

    Args:
        metadata: Dictionary mapping filenames to their metadata

    Returns:
        True if successful, False otherwise
    """
    try:
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving metadata: {e}")
        return False


def add_document_metadata(html_filename: str, navigation: List[str],
                         full_navigation: str) -> bool:
    """Add or update metadata for a document.

    Args:
        html_filename: Name of the HTML file
        navigation: List of navigation path components
        full_navigation: Full navigation string

    Returns:
        True if successful, False otherwise
    """
    metadata = load_metadata()

    metadata[html_filename] = {
        'filename': html_filename,
        'navigation': navigation,
        'full_navigation': full_navigation,
        'path': f'upload-html/{html_filename}'
    }

    return save_metadata(metadata)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and conversion"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)

        # Save uploaded file
        upload_path = UPLOAD_FOLDER / filename
        file.save(upload_path)

        # Convert to HTML
        success, result, num_images = extract_html_and_images(upload_path, UPLOAD_HTML_FOLDER)

        if success:
            # Extract navigation from content
            nav_breadcrumb = extract_navigation_from_html(result)

            if not nav_breadcrumb:
                # If no navigation found, return error
                return jsonify({
                    'success': False,
                    'error': 'No navigation found in document. Please add a navigation line like: <p>Navigation: Category > Subcategory > Document Title</p>'
                }), 400

            # Remove navigation line from HTML (since it's only for tree building)
            result = remove_navigation_from_html(result)

            # Parse navigation path
            nav_parts = parse_navigation_path(nav_breadcrumb)

            # Generate HTML filename from navigation path
            html_filename = generate_html_filename(nav_parts)
            html_path = UPLOAD_HTML_FOLDER / html_filename

            # Save HTML file without navigation line
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(result)

            # Add to consolidated metadata file
            add_document_metadata(html_filename, nav_parts, nav_breadcrumb)

            # Delete original .doc file after successful conversion
            try:
                upload_path.unlink()
                print(f"Deleted original file: {upload_path}")
            except Exception as e:
                print(f"Warning: Could not delete {upload_path}: {e}")

            return jsonify({
                'success': True,
                'filename': filename,
                'html_filename': html_filename,
                'html_path': f'upload-html/{html_filename}',
                'images': num_images,
                'navigation': nav_parts,
                'full_navigation': nav_breadcrumb
            })
        else:
            return jsonify({
                'success': False,
                'error': result
            }), 500

    return jsonify({'error': 'Invalid file type. Only .doc files are allowed'}), 400

@app.route('/api/navigation', methods=['GET'])
def get_navigation():
    """Get current navigation structure including uploaded documents"""
    navigation_file = Path('navigation.json')

    if navigation_file.exists():
        with open(navigation_file, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))

    # Return empty if no saved navigation
    return jsonify({'ape': [], 'billing': []})

@app.route('/api/navigation', methods=['POST'])
def save_navigation():
    """Save navigation structure"""
    try:
        data = request.json
        navigation_file = Path('navigation.json')

        with open(navigation_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/scan-uploads', methods=['GET'])
def scan_uploads():
    """Scan upload-html folder and return documents with their navigation.

    Reads from consolidated metadata.json file.
    """
    uploads = []

    # Load from consolidated metadata file
    metadata = load_metadata()

    for html_filename, doc_metadata in metadata.items():
        # Verify the HTML file still exists
        html_path = UPLOAD_HTML_FOLDER / html_filename
        if html_path.exists():
            uploads.append({
                'filename': html_filename,
                'path': f'upload-html/{html_filename}',
                'navigation': doc_metadata['navigation']
            })
        else:
            print(f"Warning: Metadata exists for {html_filename} but file not found")

    return jsonify({'uploads': uploads})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
