import {
  ProductDiscountSelectionStrategy,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const candidates = [];
  const metafield =
    input?.discount?.metafield?.value;

  if (!metafield) {
    return {
      operations: [],
    };
  }

  const config = JSON.parse(metafield);

  console.error(
    "CONFIG:",
    JSON.stringify(config, null, 2)
  );
  console.error("CONFIG", config);
  console.error(
    "CART LINES:",
    JSON.stringify(input.cart.lines, null, 2)
  );
  const variantIds =
    config.variantIds || [];

  const slabs =
    config.slabs || [];

  const operations = [];
console.error(
  "TOTAL LINES",
  input.cart.lines.length
);

  for (const line of input.cart.lines) {
  console.error(
    "LINE",
    line.id,
    line.merchandise.id,
    line.quantity
  );
    const merchandise =
      line.merchandise;

    if (
      merchandise.__typename !==
      "ProductVariant"
    ) {
      continue;
    }

    const isIncluded =
      variantIds.includes(
        merchandise.id
      );

    if (!isIncluded) {
      continue;
    }

    const qty = line.quantity;

    let matchedSlab = null;

    for (const slab of slabs) {

      const minQty =
        Number(slab.minQty);

      const maxQty =
        slab.maxQty === null ||
        slab.maxQty === "" ||
        slab.maxQty === undefined
          ? Infinity
          : Number(slab.maxQty);

      if (
        qty >= minQty &&
        qty <= maxQty
      ) {
        matchedSlab = slab;
      }
    }

    if (!matchedSlab) {
      continue;
    }

    const originalPrice =
      Number(
        line.cost.amountPerQuantity.amount
      );

    const discountPrice =
      Number(
        matchedSlab.discountPrice
      );

    const discountAmount =
      originalPrice - discountPrice;

    if (discountAmount <= 0) {
      continue;
    }

    console.error(
      "DISCOUNT APPLIED:",
      merchandise.id,
      qty,
      discountAmount
    );

    candidates.push({
      message: "Wholesale Price Applied",

      targets: [
        {
          cartLine: {
            id: line.id,
          },
        },
      ],

      value: {
        fixedAmount: {
          amount: discountAmount,
          appliesToEachItem: true,
        },
      },
    });
  }

  if (candidates.length === 0) {
    return {
      operations: [],
    };
  }
  console.error(
    "OPERATIONS:",
    JSON.stringify(candidates, null, 2)
  );
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy:
            ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}