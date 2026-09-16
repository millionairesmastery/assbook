-- Optional sample content. These profiles cannot sign in.
INSERT OR IGNORE INTO users (id,handle,name,bio,demo,created) VALUES
('demo-crew','assbook','The Assbook crew','Less polished. More personality. Pants firmly on.',1,1),
('demo-jean','jeanclaude','Jean Claude','Professionally behind. Personally doing great.',1,2),
('demo-anita','anitabreak','Anita Break','Taking social media a little less seriously.',1,3);
INSERT OR IGNORE INTO posts (id,user_id,body,image,created) VALUES
('welcome','demo-crew','We turned our backs on traditional social media.
Literally. Welcome to Assbook. 🍑','/street-style-friends.png',3),
('jeans','demo-jean','Finally, a platform where being behind is a good thing.',NULL,2),
('break','demo-anita','No face recognition. Just hindsight.',NULL,1);
