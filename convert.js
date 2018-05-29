var fs = require("fs");
var path = require("path");
var Importer = require('./wxr');
var cheerio = require('cheerio');
var dir = require('node-dir');
var httpreq = require('httpreq');
var _ = require('underscore');


var cheerio_html = cheerio.prototype.html;

cheerio.prototype.html = function wrapped_html() {
    var result = cheerio_html.apply(this, arguments);

    if (typeof result === 'string') {
        result = result.replace(/&#x([0-9a-f]{1,6});/ig, function (entity, code) {
            code = parseInt(code, 16);

            if (code == 0x30C4) return entity; // smile
            if (code > 0x1F389) return entity; // party popper

            // don't unescape ascii characters, assuming that all ascii characters
            // are encoded for a good reason
            if (code < 0x80) return entity;

            return String.fromCodePoint(code)
        })
    }

    return result
};


var i = 1;

if (process.argv.length < 4) {
    console.log('Specify author and start id');
    return;
}

var author = process.argv[2];

var startId = parseInt(process.argv[3]);
var id = startId;
console.log('Starting with id ' + id);

var importer = new Importer();

dir.readFiles(__dirname + '/exported',
    function (err, content, next) {
        if (err) {
            console.log(err);
            throw err;
        }

        parseAndSaveContent(content, id, author, function () {
            console.log("[" + "-".repeat(i) + "]");
            i += 1;
            id += 1;
            next();
        });
    },
    function (err, files) {
        if (err) {
            console.log(err);
            throw err;
        }
        console.log('finished reading files:', files.length);
        console.log('writing output...');

        fs.writeFile("export-" + author + "-" + startId + ".xml", importer.stringify(), function (err) {
            if (err) {
                console.log(err);
            }
            console.log("Done!")
        });
    }
);

function replaceByMap(str, replaceMap) {
    _.mapObject(replaceMap, function (val, key) {
        str = str.replace(key, val);
    });

    return str;
}

function filterText(text) {
    return text.trim()
}

function removeLineBreaks(str) {
    return str.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
}

function prepareEmbedUrl(url) {
    return (url[0] != '/') ? url : 'https://medium.com' + url;
}

function parseEmbeds(embedUrls, callback) {
    var embedUrlsMap = {};
    if (embedUrls.length < 1) {
        callback(embedUrlsMap);
    }
    var parsedEmbedsCount = 0;

    _.each(embedUrls, function (embedUrl) {
        var url = prepareEmbedUrl(embedUrl);
        httpreq.get(
            url,
            function (err, res) {
                if (err) {
                    throw err;
                }
                parsedEmbedsCount += 1;
                var parsedUrl = url;
                try {
                    var htmlDocSelector = cheerio.load(res.body);
                    var iframe = htmlDocSelector('body iframe');
                    if (iframe) {
                        var iframeSrc = iframe.attr('src');
                        parsedUrl = iframeSrc ? iframeSrc : parsedUrl;
                    }
                }
                catch (e) {
                    console.error(e);
                    console.error('Error parse ' + url + ' . Skipping.');
                }

                if (parsedUrl != embedUrl) {
                    embedUrlsMap[embedUrl] = parsedUrl;
                }

                if (parsedEmbedsCount >= embedUrls.length) {
                    callback(embedUrlsMap);
                }
            }
        );
    });
}

function findFirstImageInText(imageUrls, articleContent) {
    var earliestEncounter = articleContent.length;
    var result = null;

    for (var imageId in imageUrls) {
        var url = imageUrls[imageId];
        var index = articleContent.indexOf(url);
        if (index >= 0 && index < earliestEncounter) {
            earliestEncounter = index;
            result = imageId
        }
    }
    return result;
}

function parseAndSaveContent(content, id, author, cb) {

    // fix errors in input articles (Medium have some bugs)
    content = content.replace('/NaN/NaN/', '/1600/900/');
    content = content.replace('/max/NaN/', '/max/900/');
    content = content.replace('/NaN/max/', '/1600/max/');

    $ = cheerio.load(content);
    var articleTitle = $('header h1').text();
    articleTitle = removeLineBreaks(filterText(articleTitle));
    articleTitle = articleTitle.length ? articleTitle : "Untitled";

    var articleDescription = $('section[data-field="subtitle"]').text();
    articleDescription = removeLineBreaks(filterText(articleDescription));

    var publishDateNode = $('footer time.dt-published');
    var publishDate = (new Date()).toISOString();
    if (publishDateNode.length) {
        publishDate = publishDateNode.attr('datetime')
    }

    var articleContentEl = $('section[data-field="body"]');

    articleContentEl.find('section').first().find('h2, h3, h4').first().remove();
    articleContentEl.find('figure .aspectRatioPlaceholder-fill').remove();


    var imageIndex = 1;
    var imageUrls = {};
    articleContentEl.find('img.graf-image').each(function (i, el) {
        var imageId = parseInt(String(imageIndex) + "00" + String(id));
        imageUrls[imageId] = $(el).attr('src');
        imageIndex++;
        $(el).addClass("wp-image-" + imageId);
        $(el).addClass("size-full");
        var width = $(el).data('width');
        if (width && !$(el).attr('width')) {
            $(el).attr('width', width)
        }
        var height = $(el).data('height');
        if (height && !$(el).attr('height')) {
            $(el).attr('height', height)
        }
    });

    articleContentEl.find('.section-backgroundImage').each(function (i, el) {
        var imageUrl = $(el).css('background-image')
            .replace('url(\'', '')
            .replace('\')', '')
            .replace('url("', '')
            .replace('")', '')
        ;
        var imageId = parseInt(String(imageIndex) + "00" + String(id));
        imageUrls[imageId] = imageUrl;
        imageIndex++;

        var oldContainer = $(el).closest('.section-background');

        var imgClasses = "wp-image-" + imageId + " size-full";
        var newImage = oldContainer.before('<img src="' + imageUrl + '" class="' + imgClasses + '">');

        var parentSection = oldContainer.closest('section');

        parentSection.find('.section-aspectRatioViewportBottomSpacer').remove();
        parentSection.find('.section-aspectRatioViewportPlaceholder').remove();
        parentSection.find('.section-aspectRatioViewportBottomPlaceholder').remove();
        parentSection.find('.section-aspectRatioViewportCropPlaceholder').remove();

        oldContainer.remove();
    });


    var tags = [];
    $('footer a.p-tag').each(function () {
        var slug = $(this).attr('href')
            .replace('https://medium.com/tag/', '')
            .replace('http://medium.com/tag/', '')
            .trim();
        tags.push({
            slug: slug,
            title: $(this).text()
        });
    });

    var embedUrls = [];
    articleContentEl.find('iframe').each(function (i, el) {
        embedUrls.push($(el).attr('src'));
    });

    parseEmbeds(embedUrls, function (embedUrlsMap) {
        var articleContent = articleContentEl.html();
        articleContent = replaceByMap(articleContent, embedUrlsMap);

        articleContent = articleContent.trim();
        while (articleContent.indexOf('&nbsp;') == 0) {
            articleContent = articleContent.slice('&nbsp;'.length);
            articleContent = articleContent.trim();
        }

        if (articleContent.indexOf('/NaN/') >= 0) {
            console.log($('a.p-canonical').attr('href'));
        }

        var post = {
            id: id,
            date: publishDate,
            title: articleTitle,
            contentEncoded: articleContent,
            description: articleDescription.trim(),
            excerptEncoded: "",
            status: "draft",
            author: author,
            categories: [/*
                {
                    slug: "from-medium",
                    title: "Imported from Medium"
                }*/
            ],
            tags: tags
        };
        if (Object.keys(imageUrls).length) {
            var firstImageId = findFirstImageInText(imageUrls, articleContent);
            post['featuredImageId'] = firstImageId;
        }

        importer.addPost(post);

        _.each(imageUrls, function (value, imageId) {
            importer.addAttachment({
                id: imageId,
                parent: id,
                date: publishDate,
                title: "m-" + (value ? path.basename(value) : 'err') + " " + imageId,
                status: "inherit",
                attachmentURL: value
            })
        });

        cb();
    });
}