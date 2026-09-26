package main

import (
	"bytes"
	"encoding/json"
)

// TODO
// mergeResultSummaries combines the old stats with the new stats
func mergeResultSummaries(oldBuf, newBuf []byte) ([]byte, error) {
	var oldVal, newVal PebbleValue

	// Unmarshal new changes
	if err := json.Unmarshal(newBuf, &newVal); err != nil {
		return nil, err
	}

	// If there's no existing data, the new data becomes the base
	if len(oldBuf) == 0 {
		// Copy: newBuf is owned by pebble and may be reused.
		return bytes.Clone(newBuf), nil
	}

	// Unmarshal existing data
	if err := json.Unmarshal(oldBuf, &oldVal); err != nil {
		return nil, err
	}

	// Map to merge stats by SAN (Move)
	mergedMap := make(map[string]ResultSummary)
	for _, res := range oldVal.Results {
		mergedMap[res.San] = res
	}

	// Add or increment with new stats
	for _, newRes := range newVal.Results {
		if existing, found := mergedMap[newRes.San]; found {
			existing.WhiteWins += newRes.WhiteWins
			existing.BlackWins += newRes.BlackWins
			existing.Draws += newRes.Draws
			mergedMap[newRes.San] = existing
		} else {
			mergedMap[newRes.San] = newRes
		}
	}

	// Reconstruct the slice
	var finalResults []ResultSummary
	for _, res := range mergedMap {
		finalResults = append(finalResults, res)
	}

	return json.Marshal(PebbleValue{Results: finalResults})
}
