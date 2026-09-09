"""Confirm that the data saved by this run reached the existing Pages site."""
import json
import os
from pathlib import Path
import time
from urllib.request import Request, urlopen


def main():
    expected = {
        name: json.loads(Path('gwadastats', name).read_text(encoding='utf-8'))
        for name in ('data.json', 'update-status.json')
    }
    last_error = 'Publication pending'
    deadline = time.monotonic() + 7 * 60
    for attempt in range(30):
        try:
            for name, record in expected.items():
                url = ('https://manu.vision/gwadastats/' + name + '?check=' +
                       os.environ.get('GITHUB_RUN_ID', 'manual') + '-' + str(attempt))
                req = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'GwadaStats-PublicationCheck/1.0'})
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('Publication deadline reached')
                with urlopen(req, timeout=min(15, remaining)) as response:
                    actual = json.load(response)
                if actual != record:
                    raise ValueError(name + ' has not reached the public site yet')
            print('PASS: public data and automatic-check status match this run.')
            return
        except (OSError, ValueError) as error:
            last_error = str(error)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            if attempt < 29:
                time.sleep(min(15, remaining))
    raise SystemExit('Publication verification failed: ' + last_error)


if __name__ == '__main__':
    main()
