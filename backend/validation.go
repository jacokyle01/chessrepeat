package main

import "net/http"
import "encoding/json"
import "errors"
import "github.com/google/uuid"

func isValidName(name string) bool {
	return name != ""
}

func isValidTrainAs(trainAs string) bool {
	return trainAs == "white" || trainAs == "black"
}

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

	if !isValidName(repertoire.Name) {
		return repertoire, errors.New("invalid Name")
	}
	if !isValidTrainAs(repertoire.TrainAs) {
		return repertoire, errors.New("invalid TrainAs")
	}
	return repertoire, err
}
