"""Synthetic evidence source inputs and executable current contracts.

CURRENT_SOURCE_CASES contain only source-shaped keys accepted by the evidence
normalizer. EVIDENCE_CONTRACT_CASES pair source inputs with either expected
normalizer output or an expected exception.
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
    "legacy_adapter_missing": {
        "sources": "暂无数据",
        "methods": "暂无数据",
        "publications": "暂无数据",
        "supporting_structures": "暂无数据",
        "ddi": "暂无数据",
        "dmi": "暂无数据",
        "n_ddi": "暂无数据",
        "n_dmi": "暂无数据",
        "gold_record_count": "暂无数据",
    },
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
    "ddi_zero_count_with_details": {
        "n_ddi": 0,
        "ddi": ["DDI:SYNTHETIC_A"],
    },
}


EVIDENCE_CONTRACT_CASES: Dict[str, Dict[str, Any]] = {
    "zero_count_with_details": {
        "input": {
            "n_ddi": 0,
            "ddi": ["DDI:0001"],
        },
        "expected_output": {
            "ddiRecordCount": 0,
            "ddi": ["DDI:0001"],
            "hasDDI": True,
        },
    },
    "negative_count": {
        "input": {"n_ddi": -1},
        "expected_exception": ValueError,
    },
    "invalid_string_count": {
        "input": {"n_ddi": "not-a-number"},
        "expected_exception": ValueError,
    },
    "non_integer_count": {
        "input": {"n_ddi": 1.5},
        "expected_exception": ValueError,
    },
}
