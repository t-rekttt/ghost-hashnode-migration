# ghost-migration
## A collection of some convenient scripts to migrate your Ghost blog to Hashnode
## Usage:
1. To backup images to your machine:
- Create folder empty folder `images` inside this repo folder
- Export your Ghost data and put it inside this repo folder as `ghost-backup.json`
- `pip install requests`
- `python backup.py`
2. To restore posts and drafts to Hashnode:
- Create `.env` file with `HASHNODE_API_KEY` and `HASHNODE_COOKIE`. See `.env-example` for file structure. `HASHNODE_API_KEY` can be generated [here](https://hashnode.com/settings/developer) and `HASHNODE_COOKIE` can be grabbed by opening the browser console when visiting Hashnode and type `document.cookie`
- Replace `trekttt` in the line `findUser("trekttt")` with your Hashnode username inside `migrate.ts`
- If you want to migrate to a team blog, add the optional `publicationId` to the `migration` function inside `migrate.ts`
- `ts-node migrate.ts`
