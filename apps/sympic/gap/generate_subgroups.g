Read("color_builder_json.g");

#
# Function to construct a finitely presented triangle group for given K, L, M
#
make_klm_group := function(K, L, M)
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;
  b := F.2;
  c := F.3;
  d := F.4;
  return F/[ a*c, b*d, a^K, b^L, (a*d)^M ];
end;

#
# Function to construct a finitely presented triangle reflection group for given K, L, M
#
make_sklm_group := function(K, L, M)
  local F, a, b, c;
  F := FreeGroup("a", "b", "c");;
  a := F.1;
  b := F.2;
  c := F.3;
  return F/[ a^2, b^2, c^2, (a*b)^K,  (c*a)^L, (b*c)^M,];
end;

#
# Function to generate subgroups for a single KLM group and write it to sub/sub_KLM.json
#
process_klm_group := function(K, L, M, maxIndex, maxSubgroups)
  local G, name, s, fname, filename, outfile;
  name := Concatenation(String(K), String(L), String(M));
  Print("Processing subgroups for ", name, " maxIndex=", maxIndex, " maxSubgroups=", maxSubgroups, "\n");
  G := make_klm_group(K, L, M);
  fname := name;
  s := ColorBuilderJSON(G, name, maxIndex, maxSubgroups);
  filename := Concatenation("sub/klm/sub_", fname, ".json");
  outfile := OutputTextFile(filename, false);
  SetPrintFormattingStatus(outfile, false);
  PrintTo(outfile, s);
  CloseStream(outfile);
end;

process_group := function(G, path, name, maxIndex, maxSubgroups)
  local s, fname, filename, outfile, safe_name, c;
  Print("Processing subgroups for G=", G, " name=", name, " maxIndex=", maxIndex, " maxSubgroups=", maxSubgroups, "\n");
  s := ColorBuilderJSON(G, name, maxIndex, maxSubgroups);
  
  safe_name := "";
  for c in name do
    if c = '*' then
      Add(safe_name, 's');
    else
      Add(safe_name, c);
    fi;
  od;

  fname := Concatenation("sub_", safe_name, ".json");
  filename := Concatenation(path, fname);
  outfile := OutputTextFile(filename, false);
  SetPrintFormattingStatus(outfile, false);
  PrintTo(outfile, s);
  CloseStream(outfile);
end;


#
# Function to iterate over all KLM groups in the range [2..maxOrder]
# and write results into files sub/sub_KLM.json
#
process_klm_groups := function(maxOrder, maxIndex, maxSubgroups)
  local K, L, M;
  Print("Processing KLM groups maxOrder: ", maxOrder, " maxIndex: ", maxIndex, " maxSubgroups: ", maxSubgroups, "\n");
  for K in [2..maxOrder] do
    for L in [2..maxOrder] do
      for M in [2..maxOrder] do
        process_klm_group(K, L, M, maxIndex, maxSubgroups);
      od;
    od;
  od;
end;

#
# Function to generate subgroups for a single SKLM group and write it to sub/sklm/sub_sKLM.json
#
process_sklm_group := function(K, L, M, maxIndex, maxSubgroups)
  local G, name;
  Print("Processing subgroups for SKLM K=", K, ", L=", L, ", M=", M, "\n");
  G := make_sklm_group(K, L, M);
  name := Concatenation("*", String(K), String(L), String(M));
  process_group(G, "sub/sklm/", name, maxIndex, maxSubgroups);
end;

#
# Function to iterate over all SKLM groups in the range [2..maxOrder]
# and write results into files sub/sklm/sub_sKLM.json
#
process_sklm_groups := function(maxOrder, maxIndex, maxSubgroups)
  local K, L, M;
  Print("Processing SKLM groups maxOrder: ", maxOrder, " maxIndex: ", maxIndex, " maxSubgroups: ", maxSubgroups, "\n");
  for K in [2..maxOrder] do
    for L in [2..maxOrder] do
      for M in [2..maxOrder] do
        process_sklm_group(K, L, M, maxIndex, maxSubgroups);
      od;
    od;
  od;
end;

process_klm_groups(8, 24, 300);
#process_klm_group(6, 3, 2, 24, 300);
#process_klm_group(8, 7, 7, 24, 300);

#process_sklm_group(2, 3, 6, 24, 300);
#process_sklm_groups(8, 24, 300);

