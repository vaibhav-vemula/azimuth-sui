"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isAddress, getStationData } from "./sui";

const POLL_INTERVAL = 10_000; // 10 seconds

export function useStationData(stationAddress) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!stationAddress || !isAddress(stationAddress)) {
      setData(null);
      setError(stationAddress ? "Invalid Sui address" : null);
      return;
    }
    try {
      const bundle = await getStationData(stationAddress);
      setData(bundle);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch data");
    }
  }, [stationAddress]);

  useEffect(() => {
    if (!stationAddress) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stationAddress, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
