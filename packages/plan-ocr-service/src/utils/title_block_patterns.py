#!/usr/bin/env python3
"""
Title Block Regex Patterns Library

Common patterns for extracting sheet metadata from construction plan title blocks.
These patterns cover North American construction drawing conventions.
"""

import re
from typing import List, Dict, Optional, Tuple


# Sheet name patterns (common formats)
SHEET_NAME_PATTERNS = [
    # Standard format: "SHEET: A7" or "SHEET NO: A7"
    r'SHEET\s*(?:NO\.?|NUM\.?|NUMBER)?[:\s]+([A-Z]\d{1,2})',

    # Drawing number format: "DWG NO: A-007" or "DWG NO: A007"
    r'DWG\.?\s*(?:NO\.?|NUM\.?)?[:\s]+([A-Z])-?(\d{1,3})',

    # Sheet with dash: "A7 - Floor Plan"
    r'\b([A-Z]\d{1,2})\s*[-–]\s*[A-Za-z]',

    # Sheet name label: "SHEET NAME: A7"
    r'SHEET\s*NAME[:\s]+([A-Z]\d{1,2})',

    # Drawing title format: "A-007" or "A007"
    r'\b([A-Z])-?(\d{3})\b',

    # Simple alphanumeric: "A7", "A10", etc.
    r'\b([A-Z])(\d{1,2})\b',

    # Architectural sheet convention: "A5.1", "A7.2"
    r'\b([A-Z]\d{1,2}\.?\d?)\b',
]

# Sheet title patterns (descriptive name)
SHEET_TITLE_PATTERNS = [
    # Title after dash: "A7 - Floor Plan Level 2"
    r'[A-Z]\d{1,2}\s*[-–]\s*(.+?)(?:\n|$)',

    # Title with label: "TITLE: Floor Plan"
    r'TITLE[:\s]+(.+?)(?:\n|$)',

    # Drawing title label
    r'DRAWING\s*TITLE[:\s]+(.+?)(?:\n|$)',

    # Sheet description
    r'DESCRIPTION[:\s]+(.+?)(?:\n|$)',
]

# Project info patterns (useful for context)
PROJECT_INFO_PATTERNS = [
    r'PROJECT[:\s]+(.+?)(?:\n|$)',
    r'PROJECT\s*NAME[:\s]+(.+?)(?:\n|$)',
    r'PROJECT\s*NO\.?[:\s]+(.+?)(?:\n|$)',
]

# Date patterns (for metadata completeness)
DATE_PATTERNS = [
    r'DATE[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
]


class TitleBlockParser:
    """
    Parse OCR text from title blocks to extract structured metadata
    """

    def __init__(self, case_sensitive: bool = False):
        """
        Initialize parser

        Args:
            case_sensitive: Whether to use case-sensitive matching
        """
        self.case_sensitive = case_sensitive

    def extract_sheet_name(self, text: str) -> Optional[str]:
        """
        Extract sheet name from OCR text

        Args:
            text: OCR text from title block region

        Returns:
            Sheet name (e.g., "A7") or None
        """
        text_to_search = text if self.case_sensitive else text.upper()

        for pattern in SHEET_NAME_PATTERNS:
            flags = 0 if self.case_sensitive else re.IGNORECASE
            matches = re.search(pattern, text_to_search, flags)

            if matches:
                # Handle different capture group structures
                groups = matches.groups()
                if len(groups) == 1:
                    return groups[0].strip()
                elif len(groups) == 2:
                    # Format like "A-007" -> "A007" or "A7"
                    letter, number = groups
                    # Remove leading zeros for cleaner format
                    return f"{letter}{int(number)}"

        return None

    def extract_sheet_title(self, text: str) -> Optional[str]:
        """
        Extract sheet title/description from OCR text

        Args:
            text: OCR text from title block region

        Returns:
            Sheet title (e.g., "Floor Plan - Level 2") or None
        """
        for pattern in SHEET_TITLE_PATTERNS:
            flags = 0 if self.case_sensitive else re.IGNORECASE
            match = re.search(pattern, text, flags)

            if match:
                title = match.group(1).strip()
                # Clean up title (remove excessive whitespace)
                title = re.sub(r'\s+', ' ', title)
                return title[:100]  # Limit length

        return None

    def extract_all_sheet_names(self, text: str) -> List[str]:
        """
        Extract all potential sheet names from text (e.g., from sheet index)

        Args:
            text: OCR text potentially containing multiple sheet references

        Returns:
            List of unique sheet names
        """
        text_to_search = text if self.case_sensitive else text.upper()
        sheet_names = set()

        # Use simpler patterns for bulk extraction
        bulk_patterns = [
            r'\b([A-Z])(\d{1,2})\b',  # A7, A10
            r'\b([A-Z])-?(\d{3})\b',  # A-007, A007
        ]

        for pattern in bulk_patterns:
            flags = 0 if self.case_sensitive else re.IGNORECASE
            matches = re.findall(pattern, text_to_search, flags)

            for match in matches:
                if len(match) == 2:
                    letter, number = match
                    # Normalize: remove leading zeros
                    sheet_name = f"{letter}{int(number)}"
                    sheet_names.add(sheet_name)

        return sorted(list(sheet_names))

    def extract_project_info(self, text: str) -> Dict[str, str]:
        """
        Extract project metadata from title block

        Args:
            text: OCR text from title block

        Returns:
            Dict with project info (project_name, project_no, etc.)
        """
        info = {}

        for pattern in PROJECT_INFO_PATTERNS:
            flags = 0 if self.case_sensitive else re.IGNORECASE
            match = re.search(pattern, text, flags)

            if match:
                value = match.group(1).strip()
                value = re.sub(r'\s+', ' ', value)

                if 'PROJECT NAME' in pattern or pattern.startswith(r'PROJECT[:\s]+'):
                    info['project_name'] = value[:100]
                elif 'PROJECT NO' in pattern:
                    info['project_no'] = value[:50]

        return info

    def parse_title_block(self, text: str) -> Dict[str, any]:
        """
        Complete title block parsing - extract all metadata

        Args:
            text: OCR text from title block region

        Returns:
            Dict with extracted metadata:
            {
                'sheet_name': str,
                'sheet_title': str,
                'all_sheets': List[str],
                'project_info': Dict,
                'confidence': float
            }
        """
        result = {
            'sheet_name': None,
            'sheet_title': None,
            'all_sheets': [],
            'project_info': {},
            'confidence': 0.0
        }

        # Extract sheet name
        sheet_name = self.extract_sheet_name(text)
        if sheet_name:
            result['sheet_name'] = sheet_name
            result['confidence'] += 0.4

        # Extract sheet title
        sheet_title = self.extract_sheet_title(text)
        if sheet_title:
            result['sheet_title'] = sheet_title
            result['confidence'] += 0.3

        # Extract all sheet names (for validation context)
        all_sheets = self.extract_all_sheet_names(text)
        if all_sheets:
            result['all_sheets'] = all_sheets
            result['confidence'] += 0.2

        # Extract project info
        project_info = self.extract_project_info(text)
        if project_info:
            result['project_info'] = project_info
            result['confidence'] += 0.1

        # Normalize confidence to [0, 1]
        result['confidence'] = min(result['confidence'], 1.0)

        return result


def test_patterns():
    """Test pattern matching with example title block text"""

    parser = TitleBlockParser(case_sensitive=False)

    # Test cases
    test_cases = [
        "SHEET: A7\nFLOOR PLAN - LEVEL 2",
        "DWG NO: A-007\nTITLE: ELEVATIONS",
        "A5 - SITE PLAN\nDATE: 11/25/2024",
        "SHEET NAME: A10\nDESCRIPTION: ROOF PLAN",
        "PROJECT: CONSTRUCTION EXAMPLE\nSHEET NO: A6",
    ]

    print("Testing Title Block Patterns:\n")
    for i, text in enumerate(test_cases, 1):
        print(f"Test {i}:")
        print(f"  Input: {text.replace(chr(10), ' | ')}")
        result = parser.parse_title_block(text)
        print(f"  Sheet: {result['sheet_name']}")
        print(f"  Title: {result['sheet_title']}")
        print(f"  Confidence: {result['confidence']:.2f}")
        print()


if __name__ == '__main__':
    test_patterns()
