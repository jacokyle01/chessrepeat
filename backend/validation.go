package main

import "net/http"
import "encoding/json"
import "fmt"
import "errors"
import "github.com/google/uuid"

func isValidName(name string) bool {
	return name != ""
}

func isValidTrainAs(trainAs string) bool {
	return trainAs == "white" || trainAs == "black"
}

func isValidMove(m moveJson) bool {
	// TODO(ben): add real chess validation for move.PrevMoves (also make sure it's in the right normalized format) etc
	_, err := uuid.Parse(m.MoveId)
	if err != nil {
		return false
	}
	return true
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

func parseMovesFromRequest(r *http.Request) ([]moveJson, error) {
	var data movesJson
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&data)
	if err != nil {
		return data.Moves, err
	}
	for i := 0; i < len(data.Moves); i++ {
		if !isValidMove(data.Moves[i]) {
			return data.Moves, errors.New("invalid move:" + fmt.Sprintf("%+v", data.Moves[i]))
		}
	}
	return data.Moves, err
}
