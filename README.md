# [Phantom Tale]([url](http://phantomtale.com/))

## Adding links to a page

Every page has its own list in the `links/` folder: `index.txt` (home), `projects.txt`,
`about.txt`, `gallery.txt` and `links.txt`. **If a list is empty, nothing is shown on that page.**

Add one link per line and commit:

    https://example.com
    https://example.com | Title | Short description

- **YouTube video links** are embedded as a player automatically.
- **Any other link** becomes a card with a header screenshot, taken automatically.
- **Titles on or off:** `@title: off` hides titles for the whole page, `| notitle` hides one,
  and `| title` shows one when the page is off.
- **Heading and intro:** `@heading: My Videos` and `@intro: some text`.

A GitHub Action (`.github/workflows/screenshots.yml`) takes the screenshots, saves them in
`screenshots/` and writes `links/<page>.json`. It runs when you edit a file in `links/`, every
Monday, and on demand from the **Actions** tab. Those `.json` files and `screenshots/` are
generated, so don't edit them by hand.
