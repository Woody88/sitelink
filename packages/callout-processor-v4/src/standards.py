"""
Standards module for callout detection.

Supports:
- PSPC (Public Services and Procurement Canada) - Canadian standard
- NCS (National CAD Standard) - US standard
"""

import re
from typing import Optional, Tuple


# Common reject patterns (applies to all standards)
REJECT_PATTERNS = [
    r'NORTH', r'SCALE', r'TYP', r'SIM', r'REF', r'SEE',
    r'NOTE', r'DIM', r'SIZE', r'MIN', r'MAX', r'EXIST',
    r'NEW', r'VERIFY', r'FIELD', r'APPROX', r'ABOVE',
    r'BELOW', r'BEYOND', r'OVERALL', r'FOUND', r'OFFER',
    r'EQ', r'CLR', r'CONT', r'VARIES', r'MATCH',
    r'WINDOW', r'DOOR', r'WALL', r'FLOOR', r'CEILING',
    r'STAIR', r'ROOM', r'BATH', r'KITCHEN', r'BEDROOM',
    r'CLOSET', r'GARAGE', r'OFFICE', r'UTILITY',
    r'POST', r'BEAM', r'HEADER', r'JOIST', r'RAFTER',
    r'RIDGE', r'VALLEY', r'SLOPE', r'OVERHANG', r'ACCESS',
    r'SKYLIGHT', r'ATTIC', r'VENT', r'TRUSS', r'BRACING',
    r'STEEL', r'CONC', r'WOOD', r'METAL', r'ALUM',
    r'EXIST', r'PROP', r'FUTURE', r'OPTION', r'ALT',
]


def is_rejected_text(text: str) -> bool:
    """Check if text matches known non-callout patterns."""
    text_upper = text.upper()

    for pattern in REJECT_PATTERNS:
        if re.search(pattern, text_upper):
            return True

    # Reject if contains 3+ consecutive letters (likely a word, not callout ID)
    if re.search(r'[A-Z]{3,}', text_upper):
        return True

    # Reject if it looks like a dimension (number with unit or fraction)
    if re.search(r'\d+["\'-]', text) or re.search(r'\d+/\d+["\']', text):
        return True

    return False


# ============================================================
# PSPC (Canadian) Standard Validators
# ============================================================

def is_valid_detail_label_pspc(text: Optional[str]) -> bool:
    """
    Validate DETAIL callout labels per PSPC standard.

    Detail callouts (circles WITHOUT triangles) use NUMBERS only:
    - Simple: "1", "2", "10" (1-2 digit number)
    - With view ref: "1/A5", "3/A5" (number / sheet)
    """
    if not text:
        return False

    text = text.strip().upper()

    if len(text) == 0 or len(text) > 12:
        return False

    if is_rejected_text(text):
        return False

    # Simple number "1", "2", "10"
    if re.match(r'^[1-9][0-9]?$', text):
        return True

    # Number/sheet reference "3/A5", "1/A6"
    if re.match(r'^[1-9][0-9]?\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    # Two-part "1 A5" (number + view sheet)
    if re.match(r'^[1-9][0-9]?\s+[A-Z][0-9]{1,2}$', text):
        return True

    return False


def is_valid_section_label_pspc(text: Optional[str]) -> bool:
    """
    Validate SECTION/ELEVATION callout labels per PSPC standard.

    These callouts (circles WITH triangles) can use numbers OR single letters:
    - Numbers: "1", "2", "10"
    - Single letters: "A", "B", "C" (section identifiers) - but reject high FP letters
    - With view ref: "1/A5", "A/X2"
    """
    if not text:
        return False

    text = text.strip().upper()

    if len(text) == 0 or len(text) > 12:
        return False

    if is_rejected_text(text):
        return False

    # Simple number "1", "2", "10"
    if re.match(r'^[1-9][0-9]?$', text):
        return True

    # SINGLE letter only "A", "B", "C" - but reject high false positive letters
    if re.match(r'^[A-Z]$', text):
        # Reject letters that look like circled items or common OCR errors
        high_fp_letters = {'O', 'C', 'D', 'S', 'I', 'L', 'T', 'X', 'V', 'U', 'P', 'R', 'H', 'J'}
        if text in high_fp_letters:
            return False
        return True

    # Number/sheet reference "3/A5", "1/A6"
    if re.match(r'^[1-9][0-9]?\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    # Letter/sheet reference "A/X2", "B/A5"
    if re.match(r'^[A-Z]\s*/\s*[A-Z][0-9]{1,2}$', text):
        return True

    return False


def parse_sheet_ref_pspc(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse PSPC sheet reference format.

    Format: "A5", "B2", "X2"
    Returns: (sheet_letter, sheet_number) or (None, None)
    """
    match = re.match(r'^([A-Z])([0-9]{1,2})$', text.strip().upper())
    if match:
        return match.group(1), match.group(2)
    return None, None


# ============================================================
# NCS (US) Standard Validators
# ============================================================

def is_valid_detail_label_ncs(text: Optional[str], allow_single_letters: bool = False) -> bool:
    """
    Validate DETAIL callout labels per NCS (US) standard.

    US standards allow more flexibility:
    - Numbers: "1", "2", "10"
    - Letters: "A", "B", "C" (allowed for details in US) - but high false positive risk
    - With view ref: "1/S5.1", "A/A-201", "3/A2.1"

    US sheet numbers can have dots and dashes: "S5.1", "A-201", "A2.1"

    Args:
        text: Label text to validate
        allow_single_letters: If False (default), reject single letters to reduce false positives
    """
    if not text:
        return False

    text = text.strip().upper()

    if len(text) == 0 or len(text) > 15:
        return False

    if is_rejected_text(text):
        return False

    # US sheet reference patterns:
    # "1/S5.1", "A/A-201", "3/A2.1", "1/S-501"
    us_sheet_pattern = r'[A-Z][-.]?[0-9]{1,3}(?:\.[0-9]{1,2})?'

    # Number/sheet reference - HIGH confidence
    if re.match(rf'^[1-9][0-9]?\s*/\s*{us_sheet_pattern}$', text):
        return True

    # Letter/sheet reference - HIGH confidence
    if re.match(rf'^[A-Z]\s*/\s*{us_sheet_pattern}$', text):
        return True

    # Two-part with space "1 S5.1" - HIGH confidence
    if re.match(rf'^[A-Z0-9]{{1,2}}\s+{us_sheet_pattern}$', text):
        return True

    # Simple number "1", "2", "10" - MEDIUM confidence
    if re.match(r'^[1-9][0-9]?$', text):
        return True

    # Letter + number "A1", "B2" - MEDIUM confidence
    if re.match(r'^[A-Z][0-9]$', text):
        return True

    # Single letter "A", "B" - LOW confidence, high false positive risk
    # Only allow if explicitly enabled (for section/elevation types that need it)
    if re.match(r'^[A-Z]$', text):
        if not allow_single_letters:
            return False
        # Even when allowed, reject letters that look like circled items
        high_fp_letters = {'O', 'C', 'D', 'S', 'I', 'L', 'T', 'X', 'V', 'U', 'P', 'R', 'H', 'J'}
        if text in high_fp_letters:
            return False
        return True

    return False


def is_valid_section_label_ncs(text: Optional[str]) -> bool:
    """
    Validate SECTION/ELEVATION callout labels per NCS (US) standard.

    Section/elevation callouts (with triangles) can use single letters.
    These have visual confirmation via triangles, so lower false positive risk.
    """
    # Section/elevation callouts allow single letters since triangles confirm intent
    return is_valid_detail_label_ncs(text, allow_single_letters=True)


def parse_sheet_ref_ncs(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse NCS (US) sheet reference format.

    Formats: "S5.1", "A-201", "A2.1", "S-501"
    Returns: (discipline_prefix, sheet_id) or (None, None)
    """
    text = text.strip().upper()

    # Pattern: Letter + optional dash/dot + numbers + optional decimal
    match = re.match(r'^([A-Z])([-.]?)([0-9]{1,3}(?:\.[0-9]{1,2})?)$', text)
    if match:
        prefix = match.group(1)
        separator = match.group(2)
        number = match.group(3)
        return prefix, f"{separator}{number}" if separator else number

    return None, None


# ============================================================
# Unified Validators (try both standards)
# ============================================================

def is_valid_detail_label(text: Optional[str], standard: str = 'auto') -> bool:
    """
    Validate detail callout label.

    Args:
        text: Label text to validate
        standard: 'pspc', 'ncs', or 'auto' (try both)

    Returns:
        True if valid for the specified standard(s)
    """
    if standard == 'pspc':
        return is_valid_detail_label_pspc(text)
    elif standard == 'ncs':
        return is_valid_detail_label_ncs(text)
    else:
        # Auto: accept if valid for either standard
        return is_valid_detail_label_pspc(text) or is_valid_detail_label_ncs(text)


def is_valid_section_label(text: Optional[str], standard: str = 'auto') -> bool:
    """
    Validate section/elevation callout label.

    Args:
        text: Label text to validate
        standard: 'pspc', 'ncs', or 'auto' (try both)

    Returns:
        True if valid for the specified standard(s)
    """
    if standard == 'pspc':
        return is_valid_section_label_pspc(text)
    elif standard == 'ncs':
        return is_valid_section_label_ncs(text)
    else:
        # Auto: accept if valid for either standard
        return is_valid_section_label_pspc(text) or is_valid_section_label_ncs(text)


def detect_standard(text: str) -> str:
    """
    Detect which standard a sheet reference follows.

    Returns: 'pspc', 'ncs', or 'unknown'
    """
    text = text.strip().upper()

    # NCS patterns have dots or dashes: "S5.1", "A-201"
    if re.search(r'[A-Z][-.]?[0-9]+\.[0-9]', text):
        return 'ncs'
    if re.search(r'[A-Z]-[0-9]', text):
        return 'ncs'

    # PSPC patterns are simpler: "A5", "B2"
    if re.match(r'^[A-Z][0-9]{1,2}$', text):
        return 'pspc'

    return 'unknown'
