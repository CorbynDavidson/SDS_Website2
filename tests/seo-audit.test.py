import importlib.util
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('audit',Path(__file__).resolve().parents[1]/'scripts/audit-historical-urls.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class EvidenceImportTests(unittest.TestCase):
    def test_url_filter_preserves_real_routes_and_removes_sensitive_query_values(self):
        self.assertEqual(audit.public_path('http://sds-solicitors.com/about-us/?utm_source=test&ccm_paging_p_b1090=2#top')[0],'/about-us/?ccm_paging_p_b1090=2')
        for value in ('https://other.example/about-us/','https://www.sds-solicitors.com/submissions','/wp-admin/edit.php','/?wordfence_lh=1','/private/?email=person@example.invalid','https://user:password@sds-solicitors.com/'):
            self.assertIsNone(audit.public_path(value)[0],value)
    def test_csv_reads_bom_quoted_values_and_ignores_unrelated_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'export.csv'
            path.write_text('\ufeffPage,Clicks,Notes\n"https://www.sds-solicitors.com/about-us/",25,"quoted, note"\n',encoding='utf-8')
            self.assertEqual(list(audit.csv_paths(path)),['https://www.sds-solicitors.com/about-us/'])

if __name__=='__main__':unittest.main()
