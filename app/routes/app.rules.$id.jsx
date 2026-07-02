import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  Checkbox,
  InlineStack,
} from "@shopify/polaris";
import {
  Form,
  useLoaderData,
  useNavigate,
} from "react-router";

import { useState } from "react";
import { redirect } from "react-router";
import prisma from "../db.server";

export async function loader({ params }) {

    const rule = await prisma.wholesaleRule.findUnique({
    where: {
        id: params.id,
    },
    include: {
        products: true,
        slabs: true,
    },
    });

    if (!rule) {
    return redirect("/app/rules");
    }

  return { rule };
}

export async function action({ request, params }) {

  const formData = await request.formData();
  const widgetHeading =
    formData.get("widgetHeading");

  const backgroundColor =
    formData.get("backgroundColor");

  const borderColor =
    formData.get("borderColor");

  const textColor =
    formData.get("textColor");

  const highlightColor =
    formData.get("highlightColor");
  const actionType = formData.get("action");

  if (actionType === "delete") {

    const rule =
      await prisma.wholesaleRule.findUnique({
        where: {
          id: params.id,
        },
      });

    if (rule?.discountId) {

      const { admin } =
        await authenticate.admin(request);

      await admin.graphql(`
        mutation discountAutomaticDelete($id: ID!) {
          discountAutomaticDelete(id: $id) {
            deletedAutomaticDiscountId
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          id: rule.discountId,
        },
      });
    }

    await prisma.ruleProduct.deleteMany({
      where: {
        ruleId: params.id,
      },
    });

    await prisma.pricingSlab.deleteMany({
      where: {
        ruleId: params.id,
      },
    });

    await prisma.wholesaleRule.delete({
      where: {
        id: params.id,
      },
    });

    return redirect("/app/rules");
  }

  const name = formData.get("name");

  const enabled =
    formData.get("enabled") === "true";
  const existingRule =
    await prisma.wholesaleRule.findUnique({
      where: {
        id: params.id,
      },
    });
  const quantityDropdownEnabled =
    formData.get("quantityDropdownEnabled") === "true";
  const dropdownValues =
    formData
      .get("dropdownValues")
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean) || [];
  const products = JSON.parse(
    formData.get("products") || "[]"
  );

  const slabs = JSON.parse(
    formData.get("slabs") || "[]"
  );
  

  
  await prisma.ruleProduct.deleteMany({
    where: {
      ruleId: params.id,
    },
  });

  await prisma.pricingSlab.deleteMany({
    where: {
      ruleId: params.id,
    },
  });

  const updatedRule =
    await prisma.wholesaleRule.update({
    where: {
      id: params.id,
    },
    data: {
      name,
      enabled,
      quantityInputEnabled: quantityDropdownEnabled,
      quantityDropdown: dropdownValues,
      widgetConfig: {
        heading: widgetHeading,
        backgroundColor,
        borderColor,
        textColor,
        highlightColor,
      },      
      products: {
        create: products.map((variant) => ({
          productId: variant.productId,
          variantId: variant.variantId,
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
  });
  if (
    enabled &&
    !existingRule?.discountId
  ) {

    const { admin } =
      await authenticate.admin(request);

    const response =
      await admin.graphql(`
        mutation discountAutomaticAppCreate(
          $automaticAppDiscount:
          DiscountAutomaticAppInput!
        ) {
          discountAutomaticAppCreate(
            automaticAppDiscount:
            $automaticAppDiscount
          ) {
            automaticAppDiscount {
              discountId
            }
          }
        }
      `,{
        variables:{
          automaticAppDiscount:{
            title:name,

            functionHandle:
              "wholesale-discount",

            startsAt:new Date(),

            metafields:[
              {
                namespace:"app",
                key:"function-configuration",
                type:"json",

                value:JSON.stringify({
                  variantIds:
                    products.map(
                      p => p.variantId
                    ),

                  slabs:
                    slabs.map(
                      slab => ({
                        minQty:
                          Number(
                            slab.minQty
                          ),

                        maxQty:
                          slab.maxQty
                            ? Number(
                                slab.maxQty
                              )
                            : null,

                        discountPrice:
                          Number(
                            slab.price
                          ),
                      })
                    ),
                }),
              },
            ],
          },
        },
      });

    const data =
      await response.json();

    const discountId =
      data.data
        .discountAutomaticAppCreate
        .automaticAppDiscount
        .discountId;

    await prisma.wholesaleRule.update({
      where:{
        id:params.id,
      },
      data:{
        discountId,
      },
    });

    return redirect("/app/rules");
  }  
  if (
    existingRule?.discountId &&
    !enabled
  ) {

    const { admin } =
      await authenticate.admin(request);

    await admin.graphql(`
      mutation discountAutomaticDelete(
        $id: ID!
      ) {
        discountAutomaticDelete(
          id: $id
        ) {
          deletedAutomaticDiscountId
        }
      }
    `, {
      variables: {
        id: existingRule.discountId,
      },
    });

    await prisma.wholesaleRule.update({
      where: {
        id: params.id,
      },
      data: {
        discountId: null,
      },
    });

    return redirect("/app/rules");
  }
  if (existingRule.discountId && enabled) {

    const { admin } =
      await authenticate.admin(request);

    const response = await admin.graphql(`
      mutation discountAutomaticAppUpdate(
        $id: ID!,
        $automaticAppDiscount: DiscountAutomaticAppInput!
      ) {
        discountAutomaticAppUpdate(
          id: $id,
          automaticAppDiscount: $automaticAppDiscount
        ) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: existingRule.discountId,

        automaticAppDiscount: {
          title: name,
          combinesWith: {
            productDiscounts: true,
            orderDiscounts: false,
            shippingDiscounts: false,
          },


          metafields: [
            {
              namespace: "app",
              key: "function-configuration",
              type: "json",

              value: JSON.stringify({
                variantIds: products.map(
                  (product) => product.variantId
                ),

                slabs: slabs.map((slab) => ({
                  minQty: Number(slab.minQty),

                  maxQty: slab.maxQty
                    ? Number(slab.maxQty)
                    : null,

                  discountPrice:
                    Number(slab.price),
                })),
              })
            },
          ],
        },
      },
    });

    const data = await response.json();

    console.log(
      JSON.stringify(data, null, 2)
    );
  }  
  return redirect("/app/rules");
}

export default function EditRulePage() {

  const navigate = useNavigate();

  const { rule } = useLoaderData();

  const [name, setName] = useState(rule.name);

  const [enabled, setEnabled] = useState(rule.enabled);

  const [quantityDropdownEnabled, setQuantityDropdownEnabled] = useState(
    rule.quantityInputEnabled
  );
  const [dropdownValues, setDropdownValues] = useState(
    rule.quantityDropdown?.join(",") || ""
  );
  const [widgetHeading, setWidgetHeading] =
    useState(
      rule.widgetConfig?.heading ||
      "Wholesale Pricing"
    );

  const [backgroundColor, setBackgroundColor] =
    useState(
      rule.widgetConfig?.backgroundColor ||
      "#ffffff"
    );

  const [borderColor, setBorderColor] =
    useState(
      rule.widgetConfig?.borderColor ||
      "#d9d9d9"
    );

  const [textColor, setTextColor] =
    useState(
      rule.widgetConfig?.textColor ||
      "#000000"
    );

  const [highlightColor, setHighlightColor] =
    useState(
      rule.widgetConfig?.highlightColor ||
      "#d1fadf"
    );  
  const [products, setProducts] = useState(
    rule.products.map((p) => ({
      productId: p.productId,
      variantId: p.variantId,
      title: p.variantId,
    }))
  );

  const [slabs, setSlabs] = useState(
    rule.slabs
  );

  function updateSlab(index, field, value) {

    const updated = [...slabs];

    updated[index][field] = value;

    setSlabs(updated);
  }

  function addSlab() {

    setSlabs([
      ...slabs,
      {
        minQty: "",
        maxQty: "",
        price: "",
      },
    ]);
  }

  async function openProductPicker() {

    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      filter: {
        variants: true,
      },
    });

    if (!selected) return;

    const formatted = [];

    selected.forEach((product) => {

      product.variants.forEach((variant) => {

        formatted.push({
          productId: product.id,
          variantId: variant.id,
          title: `${product.title} - ${variant.title}`,
        });

      });

    });

    setProducts(formatted);
  }

  return (
    <Page
      title="Edit Rule"
      backAction={{
        content: "Rules",
        onAction: () => navigate("/app/rules"),
      }}
    >
      <Form method="post">

        <input
          type="hidden"
          name="name"
          value={name}
        />

        <input
          type="hidden"
          name="enabled"
          value={enabled}
        />

        <input
          type="hidden"
          name="quantityDropdownEnabled"
          value={quantityDropdownEnabled}
        />
        <input
          type="hidden"
          name="dropdownValues"
          value={dropdownValues}
        />
        <input
          type="hidden"
          name="widgetHeading"
          value={widgetHeading}
        />

        <input
          type="hidden"
          name="backgroundColor"
          value={backgroundColor}
        />

        <input
          type="hidden"
          name="borderColor"
          value={borderColor}
        />

        <input
          type="hidden"
          name="textColor"
          value={textColor}
        />

        <input
          type="hidden"
          name="highlightColor"
          value={highlightColor}
        />        
        <input
          type="hidden"
          name="products"
          value={JSON.stringify(products)}
        />

        <input
          type="hidden"
          name="slabs"
          value={JSON.stringify(slabs)}
        />

        <Layout>
          <Layout.Section>

            <Card>
              <BlockStack gap="400">

                <TextField
                  label="Rule Name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                />

                <Checkbox
                  label="Enable Rule"
                  checked={enabled}
                  onChange={setEnabled}
                />

                <BlockStack gap="300">

                  <Checkbox
                    label="Enable Quantity Dropdown"
                    checked={quantityDropdownEnabled}
                    onChange={setQuantityDropdownEnabled}
                  />

                  {quantityDropdownEnabled && (

                    <TextField
                      label="Dropdown Values"
                      helpText="Example: 5,10,20,50"
                      value={dropdownValues}
                      onChange={setDropdownValues}
                      autoComplete="off"
                    />

                  )}

                </BlockStack>

                <Button onClick={openProductPicker}>
                  Select Products
                </Button>

                <BlockStack gap="200">

                  {products.map((product) => (

                    <Card key={product.variantId}>
                      {product.title}
                    </Card>

                  ))}

                </BlockStack>
                <BlockStack gap="300">

                  <TextField
                    label="Widget Heading"
                    value={widgetHeading}
                    onChange={setWidgetHeading}
                    autoComplete="off"
                  />

                  <TextField
                    label="Background Color"
                    value={backgroundColor}
                    onChange={setBackgroundColor}
                    autoComplete="off"
                  />

                  <TextField
                    label="Border Color"
                    value={borderColor}
                    onChange={setBorderColor}
                    autoComplete="off"
                  />

                  <TextField
                    label="Text Color"
                    value={textColor}
                    onChange={setTextColor}
                    autoComplete="off"
                  />

                  <TextField
                    label="Highlight Color"
                    value={highlightColor}
                    onChange={setHighlightColor}
                    autoComplete="off"
                  />

                </BlockStack>
                <BlockStack gap="300">

                  {slabs.map((slab, index) => (

                    <InlineStack gap="300" key={index}>

                      <TextField
                        label="Min Qty"
                        type="number"
                        value={String(slab.minQty)}
                        onChange={(value) =>
                          updateSlab(index, "minQty", value)
                        }
                        autoComplete="off"
                      />

                      <TextField
                        label="Max Qty"
                        type="number"
                        value={String(slab.maxQty || "")}
                        onChange={(value) =>
                          updateSlab(index, "maxQty", value)
                        }
                        autoComplete="off"
                      />

                      <TextField
                        label="Price"
                        type="number"
                        value={String(slab.price)}
                        onChange={(value) =>
                          updateSlab(index, "price", value)
                        }
                        autoComplete="off"
                      />

                    </InlineStack>

                  ))}

                  <Button onClick={addSlab}>
                    Add Slab
                  </Button>

                </BlockStack>

                <InlineStack gap="300">

                  <button type="submit">
                    Save Changes
                  </button>

                  <button
                    type="submit"
                    name="action"
                    value="delete"
                  >
                    Delete Rule
                  </button>

                </InlineStack>

              </BlockStack>
            </Card>

          </Layout.Section>
        </Layout>

      </Form>
    </Page>
  );
}