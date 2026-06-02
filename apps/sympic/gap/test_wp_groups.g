# Test script for wp_groups.g
Read("wp_groups.g");

test_orbifolds := ["o", "**", "XX", "X*", "22*", "22X", "2222", "*2222", "2*22", "442", "*442", "4*2", "333", "*333", "3*3", "632", "*632"];

for orb in test_orbifolds do
  Print("Orbifold: ", orb, "\n");
  g := get_wp_group(orb);
  Print("  FP Group: ", g, "\n");
  Print("  Generators: ", GeneratorsOfGroup(g), "\n");
  Print("  Relators: ", RelatorsOfFpGroup(g), "\n\n");
od;
