DROP TABLE IF EXISTS repertoire;
CREATE TABLE repertoire (
  repertoire_id UUID,
  name VARCHAR(255) NOT NULL,
  train_as ENUM('white', 'black') NOT NULL,
  PRIMARY KEY (repertoire_id)
);

DROP TABLE IF EXISTS moves;
CREATE TABLE moves (
  repertoire_id UUID,
  move_id UUID,
  prev_moves TEXT(65535),
  san VARCHAR(8) NOT NULL,
  PRIMARY KEY (`repertoire_id`, `move_id`)
);
