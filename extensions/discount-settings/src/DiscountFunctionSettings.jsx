import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState } from "preact/hooks";

export default async () => {
  render(<App />, document.body);
};

function App() {

  const { applyMetafieldChange, data } = shopify;

  const existing =
    data?.metafields?.find(
      (m) => m.key === "function-configuration"
    )?.value || "{}";

  let parsed = {};

  try {
    parsed = JSON.parse(existing);
  } catch {}

  const [productId, setProductId] = useState(
    parsed.productId || ""
  );

  async function saveSettings() {

    await applyMetafieldChange({
      type: "updateMetafield",

      namespace: "app",

      key: "function-configuration",

      value: JSON.stringify({
        ...parsed,
        productId,
      }),

      valueType: "json",
    });
  }

  return (
    <s-function-settings
      onSubmit={(event) => {
        event.waitUntil(saveSettings());
      }}
    >
      <s-stack gap="base">

        <s-text-field
          label="Product ID"
          value={productId}
          onChange={(e) =>
            setProductId(e.currentTarget.value)
          }
        />

      </s-stack>
    </s-function-settings>
  );
}