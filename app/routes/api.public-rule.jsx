import prisma from "../../prisma/db.server";

export async function loader({ request }) {
  const url = new URL(request.url);

  const productId =
    url.searchParams.get("productId");

  const shopDomain =
    url.searchParams.get("shop");

  const rule =
    await prisma.wholesaleRule.findFirst({
      where: {
        enabled: true,

        shopDomain,

        products: {
          some: {
            productId,
          },
        },
      },

      include: {
        slabs: true,
      },
    });

  return Response.json(rule);
}