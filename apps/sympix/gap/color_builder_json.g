Read("gap_util.g");

ColorBuilderJSON := function( G, name, maxIndex, maxSubgroups )

  local c, count, e, gg, list, g, gens, cosets, colors, i, lastValidIndex,
        totalCount, counts, currentIndex, currentCount,
        subgroups_list, subgroup_rec, result_rec,
        res, nextIndex, nextIndexCount, indexOfSubgroupWithThatColorCount, subgroupName;

  lastValidIndex := maxIndex; 
  nextIndex := fail;
  nextIndexCount := fail;
  if maxSubgroups > 0 then
    res := findMaxIndex(G, maxSubgroups, maxIndex);
    lastValidIndex := res.lastGoodIndex;
    nextIndex := res.nextIndex;
    nextIndexCount := res.nextIndexCount;
  fi;

  # list of all subgroups of low index 
  #Print("DEBUG: G = ", G, "\n");
  #Print("DEBUG: lastValidIndex = ", lastValidIndex, "\n");
  gg := LowIndexSubgroupsFpGroup(G, lastValidIndex);  
  list := [];  
  for g in gg do 
    Add(list, [Index(G, g), GeneratorsOfGroup(g), g]);
  od;

  colors := BuildColorsList();

  Sort( list, function(v,w) return v[1] < w[1]; end );
  totalCount := Length(list);
  
  # Calculate countPerIndex
  counts := [];
  if totalCount > 0 then
    currentIndex := list[1][1];
    currentCount := 0;
    for e in list do
      if e[1] = currentIndex then
        currentCount := currentCount + 1;
      else
        Add(counts, [["index", currentIndex], ["count", currentCount]]);
        currentIndex := e[1];
        currentCount := 1;
      fi;
    od;
    Add(counts, [["index", currentIndex], ["count", currentCount]]);
  fi;

  # Crop list if it exceeds maxSubgroups
  if maxSubgroups > 0 then
    if totalCount > maxSubgroups then
      list := list{[1..maxSubgroups]};
    fi;
  fi;

  subgroups_list := [];
  count := 0;
  currentIndex := -1;
  indexOfSubgroupWithThatColorCount := 0;
  for e in list do 
    if e[1] <> currentIndex then
      currentIndex := e[1];
      indexOfSubgroupWithThatColorCount := 1;
    else
      indexOfSubgroupWithThatColorCount := indexOfSubgroupWithThatColorCount + 1;
    fi;

    gens := NormalizeGenerators(e[2], colors);
    cosets := CosetTable(G, e[3]);

    subgroupName := Concatenation(name, ".", String(e[1]), ".", String(indexOfSubgroupWithThatColorCount));

    subgroup_rec := [
      ["subgroup", subgroupName],
      ["index", e[1]],
      ["generators", gens],
      ["cosets", GetCosetsString(cosets, colors, 1)],
      ["invcos", GetCosetsString(cosets, colors, 2)]
    ];
    Add(subgroups_list, subgroup_rec);
    count := count + 1;   
  od;

  result_rec := [
    ["name", name],
    ["group", String(G)],
    ["relators", String(RelatorsOfFpGroup(G))],
    ["maxIndex", lastValidIndex],
    ["nextIndex", nextIndex],
    ["nextIndexCount", nextIndexCount],
    ["totalCount", totalCount],
    ["countPerIndex", counts],
    ["subgroups", subgroups_list]
  ];

  return PrettyPrintJSON(GapToOrderedJsonString(result_rec));
end;


Read("group_utils.g");

