import { useLoaderData, useNavigate } from "react-router";
import prisma from "../../prisma/db.server";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  IndexTable,
} from "@shopify/polaris";

export async function loader() {
  const rules = await prisma.wholesaleRule.findMany({
    include: {
      slabs: true,
      products: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return { rules };
}

export default function Index() {
  const { rules } = useLoaderData();
  const navigate = useNavigate();

  const activeRules = rules.filter((rule) => rule.enabled).length;

  const totalProducts = rules.reduce(
    (total, rule) => total + rule.products.length,
    0
  );

  const totalSlabs = rules.reduce(
    (total, rule) => total + rule.slabs.length,
    0
  );

  const recentRules = rules.slice(0, 5);

  return (
    <Page title="Wholesale Pricing">
      <Layout>
        {/* Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap>
            <div style={{ flex: "1 1 220px" }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Total Rules
                  </Text>

                  <Text as="p" variant="headingXl">
                    {rules.length}
                  </Text>
                </BlockStack>
              </Card>
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Active Rules
                  </Text>

                  <Text as="p" variant="headingXl">
                    {activeRules}
                  </Text>
                </BlockStack>
              </Card>
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Products Assigned
                  </Text>

                  <Text as="p" variant="headingXl">
                    {totalProducts}
                  </Text>
                </BlockStack>
              </Card>
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Pricing Slabs
                  </Text>

                  <Text as="p" variant="headingXl">
                    {totalSlabs}
                  </Text>
                </BlockStack>
              </Card>
            </div>
          </InlineStack>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Quick Actions
              </Text>

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  onClick={() => navigate("/app/rules/new")}
                >
                  Create Rule
                </Button>

                <Button onClick={() => navigate("/app/rules")}>
                  View All Rules
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent Rules */}
        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="400">
              <div style={{ padding: "20px 20px 0" }}>
                <Text variant="headingMd" as="h2">
                  Recent Rules
                </Text>
              </div>

              {recentRules.length > 0 ? (
                <IndexTable
                  resourceName={{
                    singular: "rule",
                    plural: "rules",
                  }}
                  itemCount={recentRules.length}
                  headings={[
                    { title: "Name" },
                    { title: "Status" },
                    { title: "Products" },
                    { title: "Slabs" },
                  ]}
                  selectable={false}
                >
                  {recentRules.map((rule, index) => (
                    <IndexTable.Row
                      id={rule.id}
                      key={rule.id}
                      position={index}
                      onClick={() => navigate(`/app/rules/${rule.id}`)}
                    >
                      <IndexTable.Cell>
                        <Text as="span" fontWeight="semibold">
                          {rule.name}
                        </Text>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        {rule.products.length}
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        {rule.slabs.length}
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              ) : (
                <div style={{ padding: "20px" }}>
                  <BlockStack gap="300">
                    <Text as="p">
                      No wholesale rules have been created yet.
                    </Text>

                    <InlineStack>
                      <Button
                        variant="primary"
                        onClick={() => navigate("/app/rules/new")}
                      >
                        Create Your First Rule
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}