package main

import "net/http"
import "encoding/json"
import "github.com/google/uuid"

func parseIdFromRequest(r *http.Request) (uuid.UUID, error) {
	unparsedId := r.PathValue("id")
	var id, err = uuid.Parse(unparsedId)
	return id, err
}

func parseRepertoireFromRequest(r *http.Request) (repertoireJson, error) {
	var repertoire repertoireJson

	var id, err = parseIdFromRequest(r)
	if err != nil {
		return repertoire, err
	}

	decoder := json.NewDecoder(r.Body)
	err = decoder.Decode(&repertoire)
	if err != nil {
		return repertoire, err
	}
	repertoire.RepertoireId = id.String()

	return repertoire, err
}
