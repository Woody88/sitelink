"""
Prompt Manager for YOLOE-26 Active Learning

Manages text prompts for YOLOE vision-language model training.
Loads prompts from JSON files, formats them for YOLOE, and supports
prompt refinement based on error analysis.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime


def load_prompts_from_json(prompt_file: str) -> Dict[str, str]:
    """
    Load prompts from JSON file and format for YOLOE.

    Args:
        prompt_file: Path to JSON prompt file (ca_ncs.json, us_ncs.json, etc.)

    Returns:
        Dictionary mapping class names to YOLOE text prompts

    Example:
        prompts = load_prompts_from_json('prompts/ca_ncs.json')
        # {'detail': 'A circular callout symbol...', 'elevation': '...'}
    """
    with open(prompt_file, 'r') as f:
        data = json.load(f)

    prompts = {}
    callout_types = data.get('callout_types', {})

    for class_name, prompt_data in callout_types.items():
        prompts[class_name] = format_prompt_for_yoloe(class_name, prompt_data)

    return prompts


def format_prompt_for_yoloe(class_name: str, prompt_data: dict) -> str:
    """
    Convert complex prompt data to simple YOLOE text description.

    YOLOE expects concise, focused text descriptions that emphasize
    key visual features without excessive detail or negative examples.

    Args:
        class_name: Callout type name (detail, elevation, section, title)
        prompt_data: Dictionary with 'text_prompt' and 'visual_characteristics'

    Returns:
        Formatted text prompt suitable for YOLOE model
    """
    text_prompt = prompt_data.get('text_prompt', '')
    visual_chars = prompt_data.get('visual_characteristics', [])

    # For YOLOE, we use the main text_prompt which already contains
    # the essential visual description. We could optionally append
    # key visual characteristics, but keeping it simple for now.

    # Extract core description (first 2-3 sentences of text_prompt)
    sentences = text_prompt.split('. ')
    core_description = '. '.join(sentences[:3])

    if not core_description.endswith('.'):
        core_description += '.'

    return core_description


def refine_prompts_from_errors(
    error_report: dict,
    current_prompts: dict,
    iteration: int
) -> dict:
    """
    Analyze errors and suggest prompt improvements.

    This function analyzes false positives and false negatives from
    validation results and suggests refinements to prompts to improve
    model performance in subsequent iterations.

    Args:
        error_report: Dictionary containing:
            - 'false_positives': List of incorrect detections
            - 'false_negatives': List of missed detections
            - 'confusion_matrix': Class confusion statistics
        current_prompts: Current prompt dictionary
        iteration: Current iteration number

    Returns:
        Dictionary with refined prompts and refinement notes

    Example:
        refined = refine_prompts_from_errors(
            error_report={'false_positives': [...], 'false_negatives': [...]},
            current_prompts={'detail': '...', 'elevation': '...'},
            iteration=1
        )
    """
    refined_prompts = current_prompts.copy()
    refinement_notes = {}

    # Analyze false positives
    false_positives = error_report.get('false_positives', [])
    fp_by_class = {}
    for fp in false_positives:
        class_name = fp.get('predicted_class', 'unknown')
        if class_name not in fp_by_class:
            fp_by_class[class_name] = []
        fp_by_class[class_name].append(fp)

    # Analyze false negatives
    false_negatives = error_report.get('false_negatives', [])
    fn_by_class = {}
    for fn in false_negatives:
        class_name = fn.get('true_class', 'unknown')
        if class_name not in fn_by_class:
            fn_by_class[class_name] = []
        fn_by_class[class_name].append(fn)

    # Generate refinements for each class
    for class_name in current_prompts.keys():
        notes = []
        current_prompt = current_prompts[class_name]

        # If high false positives, add exclusionary language
        if class_name in fp_by_class and len(fp_by_class[class_name]) > 5:
            fp_count = len(fp_by_class[class_name])
            notes.append(
                f"High false positives ({fp_count}). "
                f"Consider adding exclusionary criteria to prompt."
            )

            # Analyze common characteristics of false positives
            # This could be enhanced with actual pattern analysis
            refined_prompts[class_name] = current_prompt + (
                " Exclude symbols that are not clearly this type."
            )

        # If high false negatives, make prompt more inclusive
        if class_name in fn_by_class and len(fn_by_class[class_name]) > 5:
            fn_count = len(fn_by_class[class_name])
            notes.append(
                f"High false negatives ({fn_count}). "
                f"Consider making prompt more inclusive of variations."
            )

        if notes:
            refinement_notes[class_name] = notes

    return {
        'prompts': refined_prompts,
        'refinement_notes': refinement_notes,
        'iteration': iteration,
        'timestamp': datetime.now().isoformat()
    }


def save_prompt_version(
    iteration: int,
    prompts: dict,
    output_dir: str,
    refinement_notes: dict = None
):
    """
    Save prompt version for iteration.

    Saves prompts and optional refinement notes to a versioned file
    to track prompt evolution across active learning iterations.

    Args:
        iteration: Iteration number
        prompts: Dictionary of prompts to save
        output_dir: Directory to save prompts to
        refinement_notes: Optional notes about refinements made
    """
    os.makedirs(output_dir, exist_ok=True)

    version_data = {
        'iteration': iteration,
        'timestamp': datetime.now().isoformat(),
        'prompts': prompts,
        'refinement_notes': refinement_notes or {}
    }

    output_file = os.path.join(
        output_dir,
        f'prompts_iteration_{iteration:02d}.json'
    )

    with open(output_file, 'w') as f:
        json.dump(version_data, f, indent=2)

    print(f"Saved prompt version to: {output_file}")
    return output_file


def load_prompt_version(iteration: int, prompts_dir: str) -> dict:
    """
    Load a specific prompt version.

    Args:
        iteration: Iteration number to load
        prompts_dir: Directory containing prompt versions

    Returns:
        Dictionary containing version data including prompts
    """
    version_file = os.path.join(
        prompts_dir,
        f'prompts_iteration_{iteration:02d}.json'
    )

    if not os.path.exists(version_file):
        raise FileNotFoundError(f"Prompt version {iteration} not found: {version_file}")

    with open(version_file, 'r') as f:
        return json.load(f)


def get_initial_prompts() -> Dict[str, str]:
    """
    Get initial prompts based on ca_ncs.json structure.

    These are simple, focused prompts for YOLOE-26 that capture
    the essential visual characteristics of each callout type.

    Returns:
        Dictionary mapping class names to initial prompts
    """
    return {
        'detail': (
            "A detail callout circle with horizontal line dividing it. "
            "Above the line is a number identifier. "
            "Below the line is an alphanumeric sheet reference like A1 or B2."
        ),
        'elevation': (
            "An elevation indicator symbol with solid circle and solid black "
            "triangle marker attached to indicate viewing direction. "
            "Often found along building exteriors."
        ),
        'section': (
            "A section callout with circular symbol and two solid black triangles "
            "attached to show section cut direction. "
            "Contains letter identifier and sheet reference."
        ),
        'title': (
            "A small circular callout symbol at bottom or corner of enlarged "
            "detail drawing, contains reference number matching main plan."
        )
    }


def main():
    """
    Example usage and testing of prompt manager functions.
    """
    # Example: Load prompts from existing ca_ncs.json
    v5_prompts_dir = Path(__file__).parent.parent.parent.parent / 'callout-processor-v5' / 'prompts'
    ca_ncs_file = v5_prompts_dir / 'ca_ncs.json'

    if ca_ncs_file.exists():
        print(f"Loading prompts from: {ca_ncs_file}")
        prompts = load_prompts_from_json(str(ca_ncs_file))

        print("\nFormatted prompts for YOLOE:")
        for class_name, prompt in prompts.items():
            print(f"\n{class_name}:")
            print(f"  {prompt[:100]}...")
    else:
        print("Using initial prompts (ca_ncs.json not found)")
        prompts = get_initial_prompts()

        print("\nInitial prompts for YOLOE:")
        for class_name, prompt in prompts.items():
            print(f"\n{class_name}:")
            print(f"  {prompt}")

    # Example: Save initial version
    output_dir = Path(__file__).parent.parent / 'prompt_versions'
    save_prompt_version(
        iteration=0,
        prompts=prompts,
        output_dir=str(output_dir),
        refinement_notes={'initial': 'Initial prompts from ca_ncs.json'}
    )

    # Example: Simulate error analysis and refinement
    mock_error_report = {
        'false_positives': [
            {'predicted_class': 'detail', 'confidence': 0.7},
            {'predicted_class': 'detail', 'confidence': 0.65},
            {'predicted_class': 'elevation', 'confidence': 0.8},
        ],
        'false_negatives': [
            {'true_class': 'title', 'missed': True},
            {'true_class': 'title', 'missed': True},
            {'true_class': 'title', 'missed': True},
            {'true_class': 'title', 'missed': True},
            {'true_class': 'title', 'missed': True},
            {'true_class': 'title', 'missed': True},
        ]
    }

    print("\n\nSimulating prompt refinement...")
    refined = refine_prompts_from_errors(mock_error_report, prompts, iteration=1)

    print("\nRefinement notes:")
    for class_name, notes in refined['refinement_notes'].items():
        print(f"\n{class_name}:")
        for note in notes:
            print(f"  - {note}")

    # Save refined version
    save_prompt_version(
        iteration=1,
        prompts=refined['prompts'],
        output_dir=str(output_dir),
        refinement_notes=refined['refinement_notes']
    )


if __name__ == '__main__':
    main()
