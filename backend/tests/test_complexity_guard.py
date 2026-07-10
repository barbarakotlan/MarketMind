import os
import sys
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import check_complexity


class ComplexityGuardTests(unittest.TestCase):
    def test_reports_grade_f_function_with_location(self):
        branches = "".join(
            f"    if value == {index}:\n        return {index}\n" for index in range(check_complexity.MAX_COMPLEXITY)
        )
        source = f"def overloaded(value):\n{branches}    return -1\n"

        violations = check_complexity.find_source_violations(source, path="sample.py")

        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0].path, "sample.py")
        self.assertEqual(violations[0].name, "overloaded")
        self.assertEqual(violations[0].complexity, 41)

    def test_accepts_callable_at_limit(self):
        source = "def simple(value):\n    if value:\n        return 1\n    return 0\n"

        self.assertEqual(check_complexity.find_source_violations(source), [])


if __name__ == "__main__":
    unittest.main()
