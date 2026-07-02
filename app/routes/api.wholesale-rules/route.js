import prisma from "../../../prisma/db.server";

export async function loader() {
  const rules = await prisma.wholesaleRule.findMany({
    include: {
      products: true,
      slabs: true,
    },
  });

  return Response.json(rules);
}

export async function action({ request }) {
  const method = request.method;

  // CREATE RULE
  if (method === "POST") {
    const body = await request.json();

    const {
      name,
      enabled,
      shopDomain,
      productIds,
      slabs,
    } = body;

    const rule = await prisma.wholesaleRule.create({
      data: {
        name,
        enabled,
        shopDomain,

        products: {
          create: productIds.map((id) => ({
            productId: id,
          })),
        },
        slabs: {
          create: slabs.map((slab) => ({
            minQty: Number(slab.minQty),

            maxQty: slab.maxQty
              ? Number(slab.maxQty)
              : null,

            price: Number(slab.price),
          })),
        },        
      },

      include: {
        products: true,
      },
    });

    return Response.json(rule);
  }

  // DELETE RULE
  if (method === "DELETE") {
    const { id } = await request.json();

    await prisma.wholesaleRule.delete({
      where: { id },
    });

    return Response.json({
      success: true,
    });
  }
  // UPDATE RULE
  if (method === "PUT") {
    const body = await request.json();

    const {
      id,
      name,
      enabled,
    } = body;

    const updatedRule =
      await prisma.wholesaleRule.update({
        where: { id },

        data: {
          name,
          enabled,
        },
      });

    return Response.json(updatedRule);
  }  
}