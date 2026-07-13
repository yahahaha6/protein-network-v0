"""Synthetic evidence boundaries for current baseline and future A2 tests.

CURRENT_SOURCE_CASES contain only source-shaped keys accepted by the current
evidence normalizer and are used by A1.2 baseline tests. FUTURE_CONTRACT_CASES
preserve semantic inputs and expectations for A2; they do not define current
source-field contracts or current normalizer output.
"""

from typing import Any, Dict


CURRENT_SOURCE_CASES: Dict[str, Dict[str, Any]] = {
    "explicit_zero": {
        "n_ddi": 0,
        "ddi": [],
    },
    "unknown": {},
    "count_only": {
        "n_ddi": 2,
    },
    "positive_dmi_with_details": {
        "n_dmi": 3,
        "dmi": ["DMI:0001", "DMI:0002"],
    },
    "gold_count": {
        "gold_record_count": 4,
    },
}


# A2 source-shaped inputs stay within the current source-key vocabulary. They
# exercise the target count contract without introducing future source aliases.
A2_SOURCE_CASES: Dict[str, Dict[str, Any]] = {
    "missing_counts": {},
    "explicit_zero_counts": {
        "sources": [],
        "methods": [],
        "publications": [],
        "supporting_structures": [],
        "n_ddi": 0,
        "n_dmi": 0,
        "gold_record_count": 0,
    },
    "positive_reported_counts": {
        "sources": ["SYNTHETIC_SOURCE_A", "SYNTHETIC_SOURCE_B"],
        "methods": ["SYNTHETIC_METHOD_A", "SYNTHETIC_METHOD_B"],
        "publications": ["999999991", "999999992"],
        "supporting_structures": ["Z9Z9"],
        "n_ddi": "2",
        "n_dmi": 3,
        "gold_record_count": 4,
    },
    "unique_list_details": {
        "sources": "SYNTHETIC_SOURCE_A;SYNTHETIC_SOURCE_A|SYNTHETIC_SOURCE_B",
        "methods": ["SYNTHETIC_METHOD_A", "SYNTHETIC_METHOD_A"],
        "publications": ["999999991", "999999991", "999999992"],
        "supporting_structures": ["z9z9", "Z9Z9"],
    },
    "ddi_details_without_count": {
        "ddi": ["DDI:SYNTHETIC_A"],
    },
    "ddi_count_only": {
        "n_ddi": 2,
    },
    "ddi_count_greater_than_details": {
        "n_ddi": 2,
        "ddi": ["DDI:SYNTHETIC_A"],
    },
    "ddi_count_less_than_details": {
        "n_ddi": 1,
        "ddi": ["DDI:SYNTHETIC_A", "DDI:SYNTHETIC_B"],
    },
}


FUTURE_CONTRACT_CASES: Dict[str, Dict[str, Any]] = {
    # support_reported is semantic metadata, not a current source-field key.
    "supported_with_unknown_count": {
        "source_input": {},
        "expected_semantics": {
            "support_reported": True,
            "record_count": None,
        },
    },
    "supported_true_with_zero_count": {
        "source_input": {"n_ddi": 0},
        "expected_semantics": {
            "support_reported": True,
            "record_count": 0,
            "should_reject": True,
        },
    },
    "zero_count_with_details": {
        "source_input": {
            "n_ddi": 0,
            "ddi": ["DDI:0001"],
        },
        "expected_semantics": {
            "record_count": 0,
            "detail_records_present": True,
            "should_reject": True,
        },
    },
    "negative_count": {
        "source_input": {"n_ddi": -1},
        "expected_semantics": {"should_reject": True},
    },
    "invalid_string_count": {
        "source_input": {"n_ddi": "not-a-number"},
        "expected_semantics": {"should_reject": True},
    },
    "non_integer_count": {
        "source_input": {"n_ddi": 1.5},
        "expected_semantics": {"should_reject": True},
    },
}
