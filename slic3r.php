<?

$slicer="perl ../../dev/Slic3r/slic3r.pl";

$config=$_POST['config'];
$stl   =$_POST['stl'   ];

$configFile=tempnam('','slic3r_config_').'.ini';
file_put_contents($configFile, $config);
$stlFile   =tempnam('','slic3r_stl_').'.stl';
file_put_contents($stlFile, $stl);

$gcodeFile =tempnam('','slic3r_gcode_').'.gcode';
$errFile   =tempnam('','slic3r_err_');

//$cmd="$slicer -o $gcodeFile --load $configFile $stlFile";
$cmd="$slicer -o $gcodeFile --load config.ini $stlFile 2>$errFile";
//cho $cmd;
exec($cmd);

readfile($gcodeFile);
//echo "\n\n";
?>
