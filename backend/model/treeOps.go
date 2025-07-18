package model

func (n *MoveNode) FindByPath(path []string) *MoveNode {
	curr := n
	for _, id := range path {
		found := false
		for _, child := range curr.Children {
			if child.ID == id {
				curr = child
				found = true
				break
			}
		}
		if !found {
			return nil
		}
	}
	return curr
}

func (n *MoveNode) ReplaceNode(path []string, newNode *MoveNode) bool {
	if len(path) == 0 {
		return false
	}
	parent := n.FindByPath(path[:len(path)-1])
	if parent == nil {
		return false
	}
	for i, child := range parent.Children {
		if child.ID == path[len(path)-1] {
			parent.Children[i] = newNode
			return true
		}
	}
	return false
}

func (n *MoveNode) DeleteNode(path []string) bool {
	if len(path) == 0 {
		return false
	}
	parent := n.FindByPath(path[:len(path)-1])
	if parent == nil {
		return false
	}
	id := path[len(path)-1]
	for i, child := range parent.Children {
		if child.ID == id {
			parent.Children = append(parent.Children[:i], parent.Children[i+1:]...)
			return true
		}
	}
	return false
}
