import { json } from "react-router";
import prisma from "../db.server";

import {
  validateSlabs,
  validateDropdown,
} from "../lib/validation.server";

export async function action({ request }) {
  try {
    const body = await request.json();

    const {
      name,
      enabled,
      productIds,
      quantityDropdown,
      quantityInputEnabled,
      widgetConfig,
      slabs,
      shopDomain,
    } = body;

    validateSlabs(slabs);

    validateDropdown(quantityDropdown);

    const rule = await prisma.wholesaleRule.create({
      data: {
        name,
        enabled,
        shopDomain,



        quantityDropdown,

        quantityInputEnabled,

        widgetConfig,

        products: {
          create: productIds.map((id) => ({
            productId: id,
          })),
        },

        slabs: {
          create: slabs.map((slab) => ({
            minQty: slab.minQty,
            maxQty: slab.maxQty,
            price: slab.price,
          })),
        },
      },

      include: {
        products: true,
        slabs: true,
      },
    });

    return json({
      success: true,
      rule,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 400,
      },
    );
  }
}