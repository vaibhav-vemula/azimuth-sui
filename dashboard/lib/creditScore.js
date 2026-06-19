const AZM_DECIMALS = 1e8;

export function computeCreditScore(station) {
  if (!station || !station.registered) return 0;

  // Heartbeats: up to 300 pts (each HB = 10 pts, capped)
  const hbScore = Math.min(station.heartbeatCount * 10, 300);

  // PoA rewards: up to 400 pts (1 AZM = 5 pts)
  const poaAzm = Number(station.totalPoaRewards) / AZM_DECIMALS;
  const poaScore = Math.min(poaAzm * 5, 400);

  // PoRx rewards: up to 200 pts (1 AZM = 10 pts)
  const porxAzm = Number(station.totalPorxRewards) / AZM_DECIMALS;
  const porxScore = Math.min(porxAzm * 10, 200);

  // Registration bonus: 100 pts
  const regBonus = 100;

  return Math.round(Math.min(hbScore + poaScore + porxScore + regBonus, 1000));
}

export function computeTier(score) {
  if (score >= 750) return "Gold";
  if (score >= 400) return "Silver";
  return "Bronze";
}
