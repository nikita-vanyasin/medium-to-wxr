
## Convert Medium articles to Wordpress XML (WXR)

The script takes the folder with exported articles and converts them to WordPress WXR format: 
https://codex.wordpress.org/Importing_Content#WordPress

#### Requirements:
- Docker

#### Features:
- All images in article will be uploaded to "Media Library" in Wordpress and would be cross-linked with articles. 
- Use the first image in post as a "Featured image" in WordPress.
- Works good with iframe embeds like videos.
- Replace the background images in article to Image tag in WordPress.
- Remove some useless elements from exported HTML like empty spacers and blocks.
- Remove first header from article content because WordPress will use additional header above article.
- Save article tags.
- Save article publish date to "medium_publish_date" meta field.


#### Steps:
1) Export articles from Medium
1) Clone the repo and run: 
    ```
    # unpack the zip file to the "exported" folder:
    mkdir exported
    unzip -d exported medium.zip 
    
    # Fetch Docker Node image, I have used latest.
    docker pull node
    
    # Install NPM dependencies:
    ./run.sh npm install
    
    # Run the script.
    # You should provide author name and starting ID (it will be used as post ID in Wordpress DB).
    ./run.sh node john.smith 6000
    ```
1) The file named "export-john.smith-6000.xml" should appear in the folder.
1) In your Wordpress installation install and activate [Wordpress Importer plugin](https://codex.wordpress.org/Importing_Content#WordPress)
1) Replace wordpress-importer.php in plugin folder. My version works correctly with images in article which do not have extension.
1) Job done!
You can use  to import the file to your Wordpress installation.
I personally recommend to use the wp-cli "import" [command](https://developer.wordpress.org/cli/commands/import/) as this is much more reliable than importing through the webpage.
1) After importing to WordPress all articles are in "Draft" state so you could tune it before publishing.
See after_import.sql for handy queries to prettify article content and set publish date from medium.


#### Notes:
The project uses the altered (and improved) version of NPM node-wxr package: https://www.npmjs.com/package/wxr

Also, I have changed some behavior of cheerio package to deal with issue: https://github.com/cheeriojs/cheerio/issues/866
