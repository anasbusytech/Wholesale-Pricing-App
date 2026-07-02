document.addEventListener("DOMContentLoaded", async () => {

  const productId =
    window.ShopifyAnalytics?.meta?.product?.id;

  if (!productId) return;

  const container =
    document.getElementById(
      "wholesale-pricing-content"
    );

  const livePrice =
    document.getElementById(
      "wholesale-live-price"
    );
  const regularPrice =
      document.querySelector(
        ".price-item--regular"
      );
  const originalPriceText =
    regularPrice?.textContent;
  if (!container) return;

  const response = await fetch(
    `/apps/wholesale?productId=${productId}`
  );

  const data = await response.json();
  const rule = data.rule;
  const widgetConfig =
    rule.widgetConfig || {};
  const heading =
    document.getElementById(
      "wholesale-widget-heading"
    );

  if (heading) {

    heading.textContent =
      widgetConfig.heading ||
      "Wholesale Pricing";
  }    
  const widget = document.querySelector(".wholesale-pricing-widget");  

  if (!data.rule) {
    container.innerHTML =
      "<p>No wholesale pricing available.</p>";
    return;
  }

  const slabs = data.rule.slabs;

  let html = `
    <table style="
      width:100%;
      border-collapse:collapse;
    ">
      <tr>
        <th>Quantity</th>
        <th>Price</th>
      </tr>
  `;

  slabs.forEach((slab) => {

    html += `
      <tr data-min="${slab.minQty}"
          data-max="${slab.maxQty}"
          data-price="${slab.price}">
        <td>${slab.maxQty ? `${slab.minQty} - ${slab.maxQty}` : `${slab.minQty}+`}</td>
        <td>Rs.${slab.price}</td>
      </tr>
    `;

  });

  html += "</table>";

  container.innerHTML = html;
  if (
    rule.quantityInputEnabled &&
    rule.quantityDropdown?.length
  ) {

    const qtyInput =
      document.querySelector(
        'input[name="quantity"]'
      );

    if (qtyInput) {

      qtyInput
        .closest(".quantity")
        ?.style.setProperty(
          "display",
          "none"
        );
    }

    const dropdown =
      document.createElement("select");

    dropdown.id =
      "wholesale-qty-dropdown";

    rule.quantityDropdown.forEach(
      (qty) => {

        const option =
          document.createElement(
            "option"
          );

        option.value = qty;

        option.textContent = qty;

        dropdown.appendChild(option);
      }
    );

    container.prepend(dropdown);

    dropdown.addEventListener(
      "change",
      () => {

        if (qtyInput) {

          qtyInput.value =
            dropdown.value;

          qtyInput.dispatchEvent(
            new Event("input", {
              bubbles: true,
            })
          );
        }
      }
    );
  }

  if (widget) {

    widget.style.backgroundColor =
      widgetConfig.backgroundColor ||
      "#ffffff";

    widget.style.border =
      `1px solid ${
        widgetConfig.borderColor ||
        "#d9d9d9"
      }`;

    widget.style.color =
      widgetConfig.textColor ||
      "#000000";

    widget.style.padding = "15px";
  }
  const qtyInput =
    document.querySelector(
      'input[name="quantity"]'
    );

  if (!qtyInput) return;

  // Sync dropdown with quantity input
  const dropdown =
    document.getElementById(
      "wholesale-qty-dropdown"
    );

  if (
    dropdown &&
    qtyInput
  ) {
    dropdown.addEventListener(
      "change",
      () => {
        qtyInput.value =
          dropdown.value;
        qtyInput.dispatchEvent(
          new Event("input")
        );
      }
    );
  }

  function updateWholesalePrice() {

    const qty =
      Number(qtyInput.value);

    let matchedSlab = null;

    for (const slab of slabs) {

    if (
        slab.maxQty === null &&
        qty >= slab.minQty
    ) {
        matchedSlab = slab;
        break;
    }

    if (
        qty >= slab.minQty &&
        qty <= slab.maxQty
    ) {
        matchedSlab = slab;
        break;
    }
    }

    document
      .querySelectorAll(
        "#wholesale-pricing-content tr"
      )
      .forEach((row) => {
        row.style.background = "transparent";
      });

    if (!matchedSlab) {

    livePrice.innerHTML = "";

    if (
        regularPrice &&
        originalPriceText
    ) {
        regularPrice.textContent =
        originalPriceText;
    }

    return;
    }

    livePrice.innerHTML =
      `Wholesale Price:
       Rs.${matchedSlab.price}`;

    document
      .querySelectorAll(
        "#wholesale-pricing-content tr"
      )
      .forEach((row) => {

        if (
          Number(row.dataset.min) ===
            matchedSlab.minQty
        ) {
          row.style.background =
            widgetConfig.highlightColor ||
            "#d1fadf";
        }
      });


    if (regularPrice) {

      regularPrice.textContent =
        `Rs.${matchedSlab.price} PKR`;

    }
  }

  qtyInput.addEventListener(
    "input",
    updateWholesalePrice
  );

  updateWholesalePrice();

  document.addEventListener("change", (e) => {
    if (e.target.name === "id") {
      updateWholesalePrice();
    }
  }); 
  function getQtyInput() {
    return document.querySelector('input[name="quantity"]');
  }   
  const form = qtyInput?.closest("form");

  form?.addEventListener("submit", () => {
    qtyInput.value = qtyInput.value;
  });  
});