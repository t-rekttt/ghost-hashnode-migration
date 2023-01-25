import dotenv from "dotenv";
import fs from "fs";
dotenv.config();
import {
  findUser,
  createPublicationArticle,
  uploadImage,
  updatePublicationArticleUnofficial,
  User,
  Publication,
  createDraftUnofficial,
  updateDraftUnofficial,
} from "hashnode-sdk-js";
import { MD5 } from "crypto-js";
import sharp from "sharp";

const { HASHNODE_API_KEY, HASHNODE_COOKIE } = process.env;

let migrateImages = async (post: any) => {
  let postHtml = post.html;
  let postId = post.uuid;
  let mobileDoc = JSON.parse(post.mobiledoc);
  let cards = mobileDoc.cards;

  for (let card of cards) {
    if (card[0] == "image") {
      let retries = 0;
      let newImageUrl: string | null = null;
      let imagePath = card[1].src;

      while (retries <= 3) {
        try {
          retries++;

          if (!postHtml.includes(imagePath)) {
            console.log(`Skipped ${imagePath}`);
            break;
          }

          let hash = MD5(imagePath).toString();
          let localImagePath = `./images/${postId}/${hash}.png`;
          try {
            await sharp(localImagePath)
              .png({ quality: 80 })
              .toFile("./images/tmp.png");
          } catch (err) {
            console.log(err);
            break;
          }

          newImageUrl = await uploadImage(
            fs.createReadStream("./images/tmp.png"),
            HASHNODE_COOKIE || ""
          );
          break;
        } catch (error) {
          console.log(error);
        }
      }

      if (!newImageUrl) {
        console.log(`Given up on image ${imagePath}`);
        continue;
      }

      console.log(`Uploaded image ${imagePath}, new url: ${newImageUrl}`);

      postHtml = postHtml.replace(new RegExp(imagePath, "g"), newImageUrl);
    }
  }

  return postHtml;
};

let migratePublishedPost = async (
  publicationId: string,
  post: any,
  tags: any
): Promise<boolean> => {
  let postTitle = post.title;
  let postSlug = post.slug;
  let postCreationTime = post.created_at;
  let postHtml = await migrateImages(post);

  const article = await createPublicationArticle(
    HASHNODE_API_KEY || "",
    publicationId,
    {
      title: postTitle,
      slug: postSlug,
      contentMarkdown: postHtml,
    }
  );
  console.log(`Created article ${postTitle}`);

  await updatePublicationArticleUnofficial(
    {
      post: {
        title: postTitle,
        subtitle: "",
        contentMarkdown: postHtml,
        tags: tags.map((tag: string) => ({
          name: tag,
          slug: tag,
          _id: null,
          logo: null,
        })),
        pollOptions: [],
        type: "story",
        coverImage: "",
        coverImageAttribution: "",
        coverImagePhotographer: "",
        isCoverAttributionHidden: false,
        ogImage: "",
        metaTitle: "",
        metaDescription: "",
        isRepublished: false,
        originalArticleURL: "",
        partOfPublication: true,
        publication: publicationId,
        slug: postSlug,
        slugOverridden: false,
        importedFromMedium: false,
        dateAdded: new Date(postCreationTime).getTime(),
        hasCustomDate: true,
        hasScheduledDate: false,
        isDelisted: false,
        disableComments: false,
        stickCoverToBottom: false,
        enableToc: true,
        isNewsletterActivated: true,
        _id: article.id,
        hasLatex: false,
      },
      draftId: true,
    },
    HASHNODE_COOKIE || ""
  );

  console.log(`Updated article ${postTitle}`);
  return true;
};

let migrateDraft = async (
  user: User,
  post: any,
  tags: any,
  publicationId: Publication["id"] = user.publication.id
) : Promise<boolean> => {
  let postTitle = post.title;
  let postSlug = post.slug;
  let postCreationTime = post.created_at;
  let draftId = await createDraftUnofficial(
    publicationId,
    HASHNODE_COOKIE || ""
  );
  console.log(`Created draft ${draftId}`);

  let postHtml = await migrateImages(post);

  let data = {
    updateData: {
      _id: draftId,
      type: "story",
      contentMarkdown: postHtml,
      title: postTitle,
      subtitle: "",
      slug: postSlug,
      slugOverridden: false,
      tags: tags.map((tag: string) => ({
        name: tag,
        slug: tag,
        _id: null,
        logo: null,
      })),
      coverImage: "",
      coverImageAttribution: "",
      coverImagePhotographer: "",
      isCoverAttributionHidden: false,
      ogImage: "",
      metaTitle: "",
      metaDescription: "",
      originalArticleURL: "",
      isRepublished: false,
      partOfPublication: true,
      publication: publicationId,
      isDelisted: false,
      dateAdded: "",
      importedFromMedium: false,
      dateUpdated: postCreationTime,
      hasCustomDate: false,
      hasScheduledDate: false,
      isActive: true,
      series: null,
      pendingPublicationApproval: false,
      disableComments: false,
      stickCoverToBottom: false,
      enableToc: false,
      publishAs: null,
      isNewsletterActivated: true,
    },
    draftAuthor: user.id,
    draftId: draftId,
    options: {
      merge: true,
    },
  };

  let result = await updateDraftUnofficial(data, HASHNODE_COOKIE || "");
  if (result) console.log(`Updated draft ${draftId}`);
  else console.log(`Update draft ${draftId} failed`);
  return result;
};

let migrate = (
  user: User,
  post: any,
  tags: any,
  publicationId: string = user.publication.id
) : Promise<boolean> => {
  if (post.status == "published")
    return migratePublishedPost(publicationId, post, tags);
  else if (post.status == "draft") return migrateDraft(user, post, tags);

  // Else if unhandled post status
  return new Promise(cb => cb(false));
};

let getTags = (post: any, postsTags: any, tags: any) => {
  let postId = post.id;
  let filteredPostTags = postsTags
    .filter((item: any) => item.post_id == postId)
    .map((item: any) => item.tag_id);
  let filteredTags = tags
    .filter((tag: any) => filteredPostTags.includes(tag.id))
    .map((item: any) => item.name);

  return filteredTags;
};

(async () => {
  const user = await findUser("trekttt");
  let jsonData = JSON.parse(fs.readFileSync("./ghost-backup.json", "utf-8"));
  let postsData = jsonData.db[0].data.posts;
  let postsTags = jsonData.db[0].data.posts_tags;
  let tags_ = jsonData.db[0].data.tags;

  for (let post of postsData) {
    let tags = getTags(post, postsTags, tags_);
    let retries = 0;
    let success: boolean = false;

    while (retries <= 3) {
      try {
        retries++;
        success = await migrate(user, post, tags);
        break;
      } catch (err) {
        console.log(err);
      }
    }

    if (!success) {
      console.log(`Given up on post ${post.title}`);
    }
  }
})();
