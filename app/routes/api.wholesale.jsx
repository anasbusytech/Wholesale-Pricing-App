import prisma from "../db.server";

export async function loader({ request }) {

  const url = new URL(request.url);

  const productId =
    url.searchParams.get("productId");

  const variantId =
    url.searchParams.get("variantId");

  console.log(
    "Requested Variant:",
    variantId
  );

  const rule =
    await prisma.wholesaleRule.findFirst({
      where: {
        enabled: true,

        products: {
          some: {
            variantId:
              `gid://shopify/ProductVariant/${variantId}`,
          },
        },
      },

      include: {
        slabs: {
          orderBy: {
            minQty: "asc",
          },
        },
      },
    });

  console.log(
    "Found Rule:",
    rule?.name
  );

  return Response.json({
    success: true,
    rule,
  });
}