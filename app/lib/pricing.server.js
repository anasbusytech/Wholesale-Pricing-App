export function getMatchingSlab(qty, slabs) {
  return slabs.find((slab) => {
    const max = slab.maxQty ?? Infinity;

    return qty >= slab.minQty && qty <= max;
  });
}

export function calculateWholesalePrice(qty, slabs) {
  const slab = getMatchingSlab(qty, slabs);

  if (!slab) {
    return null;
  }

  return {
    slab,
    unitPrice: slab.price,
    totalPrice: slab.price * qty,
  };
}