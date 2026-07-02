-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleRule" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "customerTags" JSONB,
    "quantityDropdown" JSONB,
    "quantityInputEnabled" BOOLEAN NOT NULL DEFAULT false,
    "widgetConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleProduct" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "RuleProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSlab" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PricingSlab_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RuleProduct" ADD CONSTRAINT "RuleProduct_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WholesaleRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSlab" ADD CONSTRAINT "PricingSlab_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WholesaleRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
