import json, requests, os
from hashlib import md5

data = open('./ghost-backup.json', encoding='utf-8').read()
jsonData = json.loads(data)
postsData = jsonData['db'][0]['data']['posts']

BLOG_URL = 'https://thao.ghost.io'
IMAGE_DIR = './images'

for post in postsData:
    postId = post['uuid']
    mobileDoc = json.loads(post['mobiledoc'])
    cards = mobileDoc['cards']
    print(postId)
    for card in cards:
        if card[0] == 'image':
            imagePath = card[1]['src']
            imageUrl = imagePath.replace('__GHOST_URL__', BLOG_URL)
            print(imageUrl)
            if not os.path.exists(f'{IMAGE_DIR}/{postId}'):
                os.makedirs(f'{IMAGE_DIR}/{postId}')
            f = open(f'{IMAGE_DIR}/{postId}/{md5(imagePath.encode("utf-8")).hexdigest()}.png', 'wb')
            f.write(requests.get(imageUrl).content)
            f.close()
            
