export function validateSlabs(slabs) {
  if (!Array.isArray(slabs)) {
    throw new Error("Slabs must be an array");
  }

  slabs.sort((a, b) => a.minQty - b.minQty);

  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i];

    if (slab.minQty <= 0) {
      throw new Error("Minimum quantity must be greater than 0");
    }

    if (slab.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    if (
      slab.maxQty !== null &&
      slab.maxQty <= slab.minQty
    ) {
      throw new Error("Max quantity must be greater than min quantity");
    }

    if (i < slabs.length - 1) {
      const currentMax = slab.maxQty ?? Infinity;
      const nextMin = slabs[i + 1].minQty;

      if (currentMax >= nextMin) {
        throw new Error("Overlapping slabs detected");
      }
    }
  }
}

export function validateDropdown(values) {
  if (!Array.isArray(values)) {
    throw new Error("Dropdown values must be array");
  }

  const unique = new Set(values);

  if (unique.size !== values.length) {
    throw new Error("Duplicate dropdown values");
  }

  values.forEach((v) => {
    if (!Number.isInteger(v) || v <= 0) {
      throw new Error("Invalid quantity value");
    }
  });
}