const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create agents
  const marketStrategist = await prisma.agent.create({
    data: {
      name: 'Market Strategist',
      personaPrompt: 'You are an aggressive growth advocate. Prioritise market share and first-mover advantage over risk. Challenge conservative estimates. Push the team to move fast and capture opportunity before competitors do.',
      model: 'llama-3.1-8b-instant',
      seat: 'COUNCIL',
    },
  });

  const riskOfficer = await prisma.agent.create({
    data: {
      name: 'Risk Officer',
      personaPrompt: 'You are a systematic risk analyst. Identify operational, regulatory, and financial risks. Demand quantified downside scenarios. Never let the team proceed without understanding what could go wrong.',
      model: 'llama-3.1-8b-instant',
      seat: 'COUNCIL',
    },
  });

  const operationsDirector = await prisma.agent.create({
    data: {
      name: 'Operations Director',
      personaPrompt: 'You are execution-focused. Challenge plans that underestimate implementation complexity, hiring timelines, and supply chain requirements. Keep the team grounded in operational reality.',
      model: 'llama-3.1-8b-instant',
      seat: 'COUNCIL',
    },
  });

  const financialAnalyst = await prisma.agent.create({
    data: {
      name: 'Financial Analyst',
      personaPrompt: 'You are numbers-driven. Demand ROI models, burn rate projections, and payback period estimates before any strategic claim is accepted. Quantify everything.',
      model: 'llama-3.1-8b-instant',
      seat: 'ON_DECK',
    },
  });

  const customerAdvocate = await prisma.agent.create({
    data: {
      name: 'Customer Advocate',
      personaPrompt: 'You represent the end customer perspective. Question whether product-market fit in the home market translates to the target region. Ensure the team never forgets who they are building for.',
      model: 'llama-3.1-8b-instant',
      seat: 'BUNKHOUSE',
    },
  });

  // Create project
  const project = await prisma.project.create({
    data: {
      name: 'SE Asia Expansion Feasibility',
      query: 'Should our company expand into the Southeast Asian market in the next 18 months?',
      status: 'DRAFT',
    },
  });

  // Create running brief (empty initially)
  await prisma.runningBrief.create({
    data: {
      projectId: project.id,
      content: '',
      roundCount: 0,
    },
  });

  // Create Stage 1: Problem Framing
  const stage1 = await prisma.stage.create({
    data: {
      projectId: project.id,
      name: 'Problem Framing',
      orderIndex: 1,
      roundsTotal: 2,
      roundsDone: 0,
      status: 'PENDING',
    },
  });

  // Stage 1 roster: Market Strategist (COUNCIL), Risk Officer (COUNCIL),
  //   Operations Director (COUNCIL), Financial Analyst (ON_DECK)
  await prisma.stageCouncil.createMany({
    data: [
      { stageId: stage1.id, agentId: marketStrategist.id, seatType: 'COUNCIL' },
      { stageId: stage1.id, agentId: riskOfficer.id, seatType: 'COUNCIL' },
      { stageId: stage1.id, agentId: operationsDirector.id, seatType: 'COUNCIL' },
      { stageId: stage1.id, agentId: financialAnalyst.id, seatType: 'ON_DECK' },
    ],
  });

  // Create Stage 2: Solution Development
  const stage2 = await prisma.stage.create({
    data: {
      projectId: project.id,
      name: 'Solution Development',
      orderIndex: 2,
      roundsTotal: 2,
      roundsDone: 0,
      status: 'PENDING',
    },
  });

  // Stage 2 roster: Market Strategist (COUNCIL), Risk Officer (COUNCIL),
  //   Financial Analyst (COUNCIL), Customer Advocate (COUNCIL),
  //   Operations Director (ON_DECK)
  await prisma.stageCouncil.createMany({
    data: [
      { stageId: stage2.id, agentId: marketStrategist.id, seatType: 'COUNCIL' },
      { stageId: stage2.id, agentId: riskOfficer.id, seatType: 'COUNCIL' },
      { stageId: stage2.id, agentId: financialAnalyst.id, seatType: 'COUNCIL' },
      { stageId: stage2.id, agentId: customerAdvocate.id, seatType: 'COUNCIL' },
      { stageId: stage2.id, agentId: operationsDirector.id, seatType: 'ON_DECK' },
    ],
  });

  // Update project to reference first stage
  await prisma.project.update({
    where: { id: project.id },
    data: { currentStageId: stage1.id },
  });

  // Log seat assignments
  console.log('Project:', project.name);
  console.log('Stage 1: Problem Framing — Council: Market Strategist, Risk Officer, Operations Director');
  console.log('Stage 2: Solution Development — Council: Market Strategist, Risk Officer, Financial Analyst, Customer Advocate');
  console.log('Stage 2: On-Deck: Operations Director');
  console.log('Agents not yet assigned: Customer Advocate (Bunkhouse until Stage 2)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
