<?

$config=$_POST['config'];
$stl   =$_POST['stl'   ];

$configFile=tempnam('','sl3cr_config_');
$stlFile   =tempnam('','sl3cr_stl_');
$gcodeFile =tempnam('','sl3cr_gcode_');

exec("$slicer -o $gcodeFile --load $configFile $stlFile ");

readfile($gcodeFile);

?>
