package main

type moveJson struct {
	PrevMoves string `json:"prevMoves"`
	MoveId    string `json:"id"`
	San       string `json:"san"`
}
type movesJson struct {
	Moves []moveJson `json:"moves"`
}

type repertoireJson struct {
	RepertoireId string `json:"id"`
	Name         string `json:"name"`
	TrainAs      string `json:"trainAs"`
}
