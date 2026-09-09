"""Summarize source health and flag missing categories after safe publication."""
import json
import os
from pathlib import Path


def main():
    path = Path('gwadastats/update-status.json')
    if not path.exists():
        raise SystemExit('No source-check status was produced.')
    status = json.loads(path.read_text(encoding='utf-8'))
    lines = ['## Gwada Stats source check', '', 'Attempt: ' + status['lastAttempt'], '']
    for name, result in status['categories'].items():
        lines.append('- **' + name + '**: ' + result['outcome'] + '; last successful check: ' + str(result.get('lastSuccess') or 'unavailable'))
        for error in result.get('errors', []):
            print(name + ': ' + error)
    for warning in status.get('warnings', []):
        lines.append('- ' + warning)
    lines += ['', '[Public data](https://manu.vision/gwadastats/data.json) · [Check details](https://manu.vision/gwadastats/update-status.json)', '']
    summary_path = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_path:
        with open(summary_path, 'a', encoding='utf-8') as output:
            output.write('\n'.join(lines))
    if status.get('verifiedCategories', 0) < 2 or any(
        result.get('outcome') in {'unavailable', 'fallback'}
        for result in status['categories'].values()
    ):
        raise SystemExit('At least one category could not be verified. Previous values for unavailable sources were preserved.')
    print('Both categories had a supported, dated report. See warnings for any fallback sources.')


if __name__ == '__main__':
    main()
