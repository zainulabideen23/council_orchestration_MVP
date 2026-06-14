-- CreateEnum
CREATE TYPE "SeatEnum" AS ENUM ('COUNCIL', 'ON_DECK', 'BUNKHOUSE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('COUNCIL', 'ON_DECK');

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "personaPrompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'meta-llama/llama-3.1-8b-instruct',
    "seat" "SeatEnum" NOT NULL DEFAULT 'BUNKHOUSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "roundsTotal" INTEGER NOT NULL DEFAULT 3,
    "roundsDone" INTEGER NOT NULL DEFAULT 0,
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageCouncil" (
    "id" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "seatType" "SeatType" NOT NULL,
    "minimalBriefing" TEXT,

    CONSTRAINT "StageCouncil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentResponse" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "response" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunningBrief" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "roundCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageCouncil_stageId_agentId_key" ON "StageCouncil"("stageId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_stageId_roundNumber_key" ON "Round"("stageId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AgentResponse_roundId_agentId_key" ON "AgentResponse"("roundId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "RunningBrief_projectId_key" ON "RunningBrief"("projectId");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageCouncil" ADD CONSTRAINT "StageCouncil_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageCouncil" ADD CONSTRAINT "StageCouncil_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentResponse" ADD CONSTRAINT "AgentResponse_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentResponse" ADD CONSTRAINT "AgentResponse_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunningBrief" ADD CONSTRAINT "RunningBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
