# [Phantom Tale]([url](http://phantomtale.com/))

## Adding links to the Links page

1. Open `links.txt` and add a line with a URL (optionally `| Title | Description`).
2. Commit the change.
3. A GitHub Action (`.github/workflows/screenshots.yml`) screenshots every link,
   saves the images in `screenshots/`, and updates `links.json`. It also refreshes
   everything every Monday. You can run it any time from the **Actions** tab.

`links.json` and `screenshots/` are generated, so there is no need to edit them by hand.
