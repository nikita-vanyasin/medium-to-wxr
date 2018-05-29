
# repeat next two queries until no rows is changing
UPDATE wp_posts
SET
    post_excerpt = TRIM(BOTH "\n" FROM post_excerpt),
    post_content = TRIM(BOTH "\n" FROM post_content);

UPDATE wp_posts
SET
    post_excerpt = TRIM(post_excerpt),
    post_content = TRIM(post_content);



# copy medium publish date. Run after articles publication!
BEGIN;
UPDATE wp_posts p INNER JOIN wp_postmeta m ON p.ID = m.post_id
                                                                AND p.post_type = 'post'
                                                                AND m.meta_key = 'medium_publish_date'
                                                                AND p.post_status = 'publish'
SET
    p.post_date = STR_TO_DATE(TRIM(m.meta_value), '%Y-%m-%d %H:%i:%s'),
    p.post_modified = STR_TO_DATE(TRIM(m.meta_value), '%Y-%m-%d %H:%i:%s'),
    p.post_date_gmt = DATE_SUB(p.post_date, INTERVAL 3 HOUR),
    p.post_modified_gmt =   DATE_SUB(p.post_modified, INTERVAL 3 HOUR)
;
COMMIT;



