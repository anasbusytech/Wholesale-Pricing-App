import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Button,
} from "@shopify/polaris";

import {
  Outlet,
  useLocation,
  useNavigate,
  useLoaderData,
} from "react-router";

import prisma from "../db.server";

export async function loader() {

  const rules = await prisma.wholesaleRule.findMany({
    include: {
      products: true,
      slabs: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    rules,
  };
}

export default function RulesPage() {

  const location = useLocation();
  const navigate = useNavigate();

  const { rules } = useLoaderData();

    if (
    location.pathname === "/app/rules/new" ||
    location.pathname.startsWith("/app/rules/")
    ) {
    return <Outlet />;
    }

  return (
    <Page title="Wholesale Rules">

      <div style={{ marginBottom: "16px" }}>
        <Button
          variant="primary"
          onClick={() => navigate("/app/rules/new")}
        >
          Create Rule
        </Button>
      </div>

      <Layout>
        <Layout.Section>

          <Card padding="0">

            <IndexTable
              resourceName={{
                singular: "rule",
                plural: "rules",
              }}
              itemCount={rules.length}
              headings={[
                { title: "Name" },
                { title: "Status" },
                { title: "Products" },
                { title: "Slabs" },
              ]}
              selectable={false}
            >

            {rules.map((rule, index) => (
            <IndexTable.Row
                id={rule.id}
                key={rule.id}
                position={index}
                onClick={() => navigate(`/app/rules/${rule.id}`)}
            >
                <IndexTable.Cell>
                {rule.name}
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

            {rules.length === 0 && (
              <div style={{ padding: "20px" }}>
                <Text as="p">
                  No rules created yet.
                </Text>
              </div>
            )}

          </Card>

        </Layout.Section>
      </Layout>
    </Page>
  );
}