# generate_subgroups.g
# Execute subgroup generation for KLM/SKLM groups and custom wallpaper groups.

Read("klm_groups.g");
Read("wp_groups.g");

#
# Function to generate subgroups for a single custom wallpaper group and write to sub/wp/sub_name.json
#
process_wp_group := function(name, maxIndex, maxSubgroups)
  local G;
  Print("Processing subgroups for WP group name=", name, " maxIndex=", maxIndex, " maxSubgroups=", maxSubgroups, "\n");
  G := get_wp_group(name);
  process_group(G, "sub/wp/", name, maxIndex, maxSubgroups);
end;

#process_klm_groups(8, 24, 300);
#process_klm_group(6, 3, 2, 24, 300);
#process_klm_group(8, 7, 7, 24, 300);

#process_sklm_group(2, 3, 6, 24, 300);
#process_sklm_groups(8, 24, 300);

process_wp_group("o", 24, 300);
