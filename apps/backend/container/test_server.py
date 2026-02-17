"""
Tests for /render-pages endpoint in server.py.
Run inside Docker container: pytest test_server.py -v
Or locally if pyvips and PyMuPDF are installed.
"""
import json
import base64
import pytest
import fitz  # PyMuPDF


@pytest.fixture
def client():
    from server import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def make_pdf(num_pages=1):
    """Create a minimal valid PDF with the given number of pages."""
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Test Page {i + 1}")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


class TestRenderPages:
    def test_returns_400_for_missing_plan_id(self, client):
        response = client.post(
            '/render-pages',
            data=b'fake-pdf',
            headers={'X-Page-Numbers': '[1]'},
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_returns_400_for_missing_page_numbers(self, client):
        response = client.post(
            '/render-pages',
            data=b'fake-pdf',
            headers={'X-Plan-Id': 'test-plan'},
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_returns_400_for_empty_page_numbers(self, client):
        response = client.post(
            '/render-pages',
            data=b'fake-pdf',
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[]',
            },
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_returns_400_for_no_pdf_data(self, client):
        response = client.post(
            '/render-pages',
            data=b'',
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[1]',
            },
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_renders_single_page(self, client):
        pdf_data = make_pdf(1)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[1]',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'pages' in data
        assert len(data['pages']) == 1

        page = data['pages'][0]
        assert page['pageNumber'] == 1
        assert 'pngBase64' in page
        assert page['width'] > 0
        assert page['height'] > 0

        # Verify base64 decodes to valid PNG (PNG magic bytes: 89 50 4E 47)
        png_bytes = base64.b64decode(page['pngBase64'])
        assert png_bytes[:4] == b'\x89PNG'

    def test_renders_multiple_pages(self, client):
        pdf_data = make_pdf(3)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[1, 2, 3]',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['pages']) == 3

        for i, page in enumerate(data['pages']):
            assert page['pageNumber'] == i + 1
            assert 'pngBase64' in page
            assert page['width'] > 0
            assert page['height'] > 0
            png_bytes = base64.b64decode(page['pngBase64'])
            assert png_bytes[:4] == b'\x89PNG'

    def test_renders_subset_of_pages(self, client):
        pdf_data = make_pdf(4)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[1, 3]',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['pages']) == 2
        assert data['pages'][0]['pageNumber'] == 1
        assert data['pages'][1]['pageNumber'] == 3

    def test_handles_invalid_page_number(self, client):
        pdf_data = make_pdf(1)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[99]',
                'Content-Type': 'application/pdf',
            },
        )
        # Should return 500 since page 99 doesn't exist in a 1-page PDF
        assert response.status_code == 500
        data = json.loads(response.data)
        assert 'error' in data

    def test_rejects_non_integer_page_numbers(self, client):
        pdf_data = make_pdf(1)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[1.5]',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_rejects_zero_page_number(self, client):
        pdf_data = make_pdf(1)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[0]',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_rejects_negative_page_number(self, client):
        pdf_data = make_pdf(1)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[-1]',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_handles_invalid_json_in_page_numbers(self, client):
        pdf_data = make_pdf(1)
        response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': 'not-json',
                'Content-Type': 'application/pdf',
            },
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_page_dimensions_match_render_page(self, client):
        """Verify /render-pages returns same dimensions as /render-page for same PDF."""
        pdf_data = make_pdf(1)

        # Call /render-page (existing endpoint)
        single_response = client.post(
            '/render-page',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Number': '1',
                'Content-Type': 'application/pdf',
            },
        )
        assert single_response.status_code == 200
        single_width = int(single_response.headers['X-Width'])
        single_height = int(single_response.headers['X-Height'])

        # Call /render-pages (new endpoint)
        batch_response = client.post(
            '/render-pages',
            data=pdf_data,
            headers={
                'X-Plan-Id': 'test-plan',
                'X-Page-Numbers': '[1]',
                'Content-Type': 'application/pdf',
            },
        )
        assert batch_response.status_code == 200
        batch_data = json.loads(batch_response.data)
        batch_page = batch_data['pages'][0]

        assert batch_page['width'] == single_width
        assert batch_page['height'] == single_height
