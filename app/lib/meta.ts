import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Vacaro";
export const SITE_URL = "https://vacaro.astalum.dev";
export const DEFAULT_TITLE = "Vacaro — みんなの予定が、ひとつになる";
export const DEFAULT_DESCRIPTION =
	"期間を決めて空いている時間を集める、シンプルな日程調整アプリ。";
export const OGP_IMAGE_URL = `${SITE_URL}/vacaro-og.png`;

export function createPageMeta(
	title = DEFAULT_TITLE,
	description = DEFAULT_DESCRIPTION,
): MetaDescriptor[] {
	return [
		{ title },
		{ name: "description", content: description },
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:locale", content: "ja_JP" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:image", content: OGP_IMAGE_URL },
		{ property: "og:image:secure_url", content: OGP_IMAGE_URL },
		{ property: "og:image:type", content: "image/png" },
		{ property: "og:image:width", content: "1731" },
		{ property: "og:image:height", content: "909" },
		{
			property: "og:image:alt",
			content: "Vacaro — みんなの予定が、ひとつになる。",
		},
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: OGP_IMAGE_URL },
		{
			name: "twitter:image:alt",
			content: "Vacaro — みんなの予定が、ひとつになる。",
		},
	];
}
