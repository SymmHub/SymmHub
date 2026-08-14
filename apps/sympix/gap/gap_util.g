LoadPackage("json");

NormalizeGenerators := function(gens, colors)
  local out, g, w, rep, str, i, val, char;
  out := [];
  for g in gens do
    w := UnderlyingElement(g);
    rep := LetterRepAssocWord(w);
    str := "";
    for i in [1..Length(rep)] do
      val := rep[i];
      if val > 0 then
        char := colors[val];
      else
        char := colors[26 - val];
      fi;
      Add(str, char);
    od;
    Add(out, Reversed(str));
  od;
  return JoinStringsWithSeparator(out, " ");
end;

ReverseElements := function(list) 
  local outlist,e;
  outlist := [];
  for e in list do 
      Add(outlist,e);
  od;
  return outlist;
end;

#
#  convert cosets into string abcd...
#
GetCosetsString := function(cosets, colors, start)
  local i, j, c, str, coset, out;
  out := "";
  str := "";
  i := start;
  
  while i <= Length(cosets) do   

    coset := cosets[i];    
    for j in [1..Length(coset)] do   
      Add(str,colors[coset[j]]);
    od;
    i := i+2;
    if i <= Length(cosets) then 
      Add(str,' ');
    fi;
  od;
  return str;
end;

findMaxIndex := function(G, maxSubgroups, maxLimit)
  local maxIndex, gg, count, G_copy, prevCount, lastIndexWithSubgroups;
  maxIndex := 2;
  prevCount := 1;
  lastIndexWithSubgroups := 2;
  while maxIndex <= maxLimit do
    G_copy := FreeGroupOfFpGroup(G) / RelatorsOfFpGroup(G);
    gg := LowIndexSubgroupsFpGroup(G_copy, maxIndex);
    count := Length(gg);
    #Print("  maxIndex: ", maxIndex, " count: ", count, "\n");
    if count > maxSubgroups then
      if maxIndex > 2 then
        return rec(nextIndex := maxIndex, nextIndexCount := count - prevCount, lastGoodIndex := lastIndexWithSubgroups);
      else
        return rec(nextIndex := 2, nextIndexCount := count - prevCount, lastGoodIndex := 2);
      fi;
    fi;
    if count - prevCount > 0 then
      lastIndexWithSubgroups := maxIndex;
    fi;
    prevCount := count;
    maxIndex := maxIndex + 1;
  od;
  return rec(nextIndex := fail, nextIndexCount := fail, lastGoodIndex := lastIndexWithSubgroups);
end;

PrettyPrintJSON := function(s)
  local out, indent, in_string, escaped, i, char, next_char, spaces;
  out := "";
  indent := 0;
  in_string := false;
  escaped := false;
  
  spaces := function(n)
    local j, sp;
    sp := "";
    for j in [1..n] do
      Add(sp, ' ');
    od;
    return sp;
  end;

  i := 1;
  while i <= Length(s) do
    char := s[i];
    if in_string then
      Add(out, char);
      if escaped then
        escaped := false;
      elif char = '\\' then
        escaped := true;
      elif char = '"' then
        in_string := false;
      fi;
    else
      if char = '"' then
        in_string := true;
        Add(out, char);
      elif char = '{' or char = '[' then
        Add(out, char);
        if i < Length(s) and (s[i+1] = '}' or s[i+1] = ']') then
          # Empty structures like {} or []
        else
          indent := indent + 1;
          Append(out, "\n");
          Append(out, spaces(indent * 2));
        fi;
      elif char = '}' or char = ']' then
        if i > 1 and (s[i-1] = '{' or s[i-1] = '[') then
          Add(out, char);
        else
          indent := indent - 1;
          Append(out, "\n");
          Append(out, spaces(indent * 2));
          Add(out, char);
        fi;
      elif char = ',' then
        Add(out, char);
        Append(out, "\n");
        Append(out, spaces(indent * 2));
      elif char = ':' then
        Append(out, ": ");
      elif char = ' ' or char = '\n' or char = '\r' or char = '\t' then
        # Skip extra whitespaces outside of strings
      else
        Add(out, char);
      fi;
    fi;
    i := i + 1;
  od;
  return out;
end;

GapToOrderedJsonString := function(obj)
  local out, i, first;
  if obj = fail then
    return "null";
  elif IsInt(obj) or IsFloat(obj) then
    return String(obj);
  elif IsBool(obj) then
    if obj = true then return "true"; else return "false"; fi;
  elif IsString(obj) then
    return Concatenation("\"", JSON_ESCAPE_STRING(obj), "\"");
  elif IsList(obj) then
    # Check if this is a non-empty list of [string, value] pairs
    if Length(obj) > 0 and IsList(obj[1]) and Length(obj[1]) = 2 and IsString(obj[1][1]) then
      out := "{";
      first := true;
      for i in obj do
        if first then first := false; else Append(out, ","); fi;
        Append(out, Concatenation("\"", i[1], "\":"));
        Append(out, GapToOrderedJsonString(i[2]));
      od;
      Append(out, "}");
      return out;
    else
      out := "[";
      first := true;
      for i in obj do
        if first then first := false; else Append(out, ","); fi;
        Append(out, GapToOrderedJsonString(i));
      od;
      Append(out, "]");
      return out;
    fi;
  elif IsRecord(obj) then
    out := "{";
    first := true;
    for i in Set(RecNames(obj)) do
      if first then first := false; else Append(out, ","); fi;
      Append(out, Concatenation("\"", i, "\":"));
      Append(out, GapToOrderedJsonString(obj.(i)));
    od;
    Append(out, "}");
    return out;
  else
    return Concatenation("\"", JSON_ESCAPE_STRING(String(obj)), "\"");
  fi;
end;

BuildColorsList := function()
  local colors, i;
  colors := [];
  for i in [0..INT_CHAR('z')-INT_CHAR('a')] do
    Add(colors, CHAR_INT(INT_CHAR('a')+i));
  od;
  for i in [0..INT_CHAR('Z')-INT_CHAR('A')] do
    Add(colors, CHAR_INT(INT_CHAR('A')+i));
  od;
  for i in [0..INT_CHAR('9')-INT_CHAR('0')] do
    Add(colors, CHAR_INT(INT_CHAR('0')+i));
  od;
  return colors;
end;
